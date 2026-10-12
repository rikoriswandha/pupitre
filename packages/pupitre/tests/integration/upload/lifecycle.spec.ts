import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import { defineResource, schema } from '../../../index.js'
import { executeBuiltinDelete } from '../../../src/compiler/action_compiler.js'
import { createPupitreStorage } from '../../../src/storage/index.js'
import { consumeFormUploads, pruneTrackedUploads } from '../../../src/storage/upload_tracking.js'
import { createTestApp, closeTestApp, Post } from '../../helpers/app.js'
import { buildTableData } from '../../../src/table/table_data.js'
import { setTimeout } from 'node:timers/promises'

const form = [schema.fileUpload('cover').toDefinition()]
const ctx = { logger: { error() {} } } as unknown as HttpContext

test.group('upload lifecycle audit regressions', () => {
  test('hard deletes clean bytes only after commit, shared and soft-deleted keys survive', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const storage = createPupitreStorage()
      await storage.put('cover.png', Buffer.from('bytes'), {
        contentType: 'image/png',
        visibility: 'public',
      })
      const post = await Post.create({
        title: 'One',
        slug: 'one',
        status: 'draft',
        cover: 'cover.png',
      })
      const other = await Post.create({
        title: 'Two',
        slug: 'two',
        status: 'draft',
        cover: 'cover.png',
      })
      const resource = defineResource(Post)
        .form((fields) => [fields.fileUpload('cover')])
        .toDefinition()
      await executeBuiltinDelete(resource, [post], ctx)
      assert.isTrue(await storage.exists('cover.png'))
      const soft = { ...resource, softDeletes: 'deletedAt' }
      await executeBuiltinDelete(soft, [other], ctx)
      assert.isTrue(await storage.exists('cover.png'))
      await executeBuiltinDelete(soft, [other], ctx, true)
      assert.isFalse(await storage.exists('cover.png'))
      const rollback = await Post.create({
        title: 'Rollback',
        slug: 'rollback',
        status: 'draft',
        cover: 'rollback.png',
      })
      await storage.put('rollback.png', Buffer.from('bytes'), {
        contentType: 'image/png',
        visibility: 'public',
      })
      await assert.rejects(() =>
        executeBuiltinDelete(
          {
            ...resource,
            hooks: {
              ...resource.hooks,
              afterDelete() {
                throw new Error('rollback')
              },
            },
          },
          [rollback],
          ctx
        )
      )
      assert.isTrue(await storage.exists('rollback.png'))
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('storage errors are logged and cannot roll back committed deletion', async ({ assert }) => {
    const fixture = await createTestApp()
    try {
      const drive = await fixture.app.container.make('drive.manager')
      const disk = drive.use()
      const original = disk.delete
      let logged = 0
      disk.delete = async () => {
        throw new Error('storage offline')
      }
      try {
        const post = await Post.create({
          title: 'Delete',
          slug: 'delete',
          status: 'draft',
          cover: 'error.png',
        })
        await executeBuiltinDelete(
          defineResource(Post)
            .form((fields) => [fields.fileUpload('cover')])
            .toDefinition(),
          [post],
          {
            logger: {
              error() {
                logged++
              },
            },
          } as unknown as HttpContext
        )
        assert.isNull(await Post.find(post.id))
        assert.equal(logged, 1)
      } finally {
        disk.delete = original
      }
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('nested multiple file fields clean only unshared keys', async ({ assert }) => {
    const fixture = await createTestApp()
    try {
      const storage = createPupitreStorage()
      for (const key of ['nested.png', 'shared-nested.png', 'repeater.png']) {
        await storage.put(key, Buffer.from('bytes'), {
          contentType: 'image/png',
          visibility: 'public',
        })
      }
      const first = await Post.create({
        title: 'Nested',
        slug: 'nested',
        status: 'draft',
        metadata: { attachments: ['nested.png', 'shared-nested.png'] },
        items: [{ sku: 'file', qty: 1, attachment: 'repeater.png' }],
      })
      await Post.create({
        title: 'Other',
        slug: 'other',
        status: 'draft',
        metadata: { attachments: ['shared-nested.png'] },
      })
      const resource = {
        ...defineResource(Post).toDefinition(),
        form: [
          schema.fileUpload('metadata.attachments').multiple().toDefinition(),
          schema
            .repeater('items')
            .schema([schema.fileUpload('attachment')])
            .toDefinition(),
        ],
      }
      await executeBuiltinDelete(resource, [first], ctx)
      assert.isFalse(await storage.exists('nested.png'))
      assert.isFalse(await storage.exists('repeater.png'))
      assert.isTrue(await storage.exists('shared-nested.png'))
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('prune requires the migration instead of silently ignoring missing tracking', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const db = await fixture.app.container.make('lucid.db')
      await db.connection().schema.dropTableIfExists('pupitre_uploads')
      await assert.rejects(() => pruneTrackedUploads(86400000), /migration/)
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('bounded prune keeps consumed, fresh, and referenced uploads; page consumption reserves bytes', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const db = await fixture.app.container.make('lucid.db')
      await db.connection().schema.dropTableIfExists('pupitre_uploads')
      await db.connection().schema.createTable('pupitre_uploads', (table) => {
        table.string('key').primary()
        table.string('disk').nullable()
        table.string('owner')
        table.string('panel')
        table.string('resource')
        table.string('field')
        table.bigInteger('created_at')
        table.bigInteger('consumed_at').nullable()
      })
      const storage = createPupitreStorage()
      for (const key of ['old.png', 'used.png', 'fresh.png', 'shared.png', 'page.png']) {
        await storage.put(key, Buffer.from('bytes'), {
          contentType: 'image/png',
          visibility: 'public',
        })
        await db.table('pupitre_uploads').insert({
          key,
          disk: null,
          owner: 'session',
          panel: 'admin',
          resource: key === 'page.png' ? 'settings' : 'posts',
          field: 'cover',
          created_at: key === 'fresh.png' ? Date.now() : 0,
          consumed_at: key === 'used.png' ? 1 : null,
        })
      }
      await Post.create({ title: 'Shared', slug: 'shared', status: 'draft', cover: 'shared.png' })
      await consumeFormUploads(
        {
          session: { get: () => [{ resource: 'settings', field: 'cover', key: 'page.png' }] },
        } as unknown as HttpContext,
        'settings',
        form,
        { cover: 'page.png' }
      )
      const drive = await fixture.app.container.make('drive.manager')
      const disk = drive.use()
      const originalDelete = disk.delete
      let failures = 0
      disk.delete = async () => {
        throw new Error('temporarily offline')
      }
      try {
        assert.equal(
          await pruneTrackedUploads(86400000, 100, () => {
            failures++
          }),
          0
        )
        assert.equal(failures, 1)
        assert.exists(await db.from('pupitre_uploads').where('key', 'old.png').first())
      } finally {
        disk.delete = originalDelete
      }
      await storage.put('old-second.png', Buffer.from('bytes'), {
        contentType: 'image/png',
        visibility: 'public',
      })
      await db.table('pupitre_uploads').insert({
        key: 'old-second.png',
        disk: null,
        owner: 'session',
        panel: 'admin',
        resource: 'posts',
        field: 'cover',
        created_at: 1,
        consumed_at: null,
      })
      assert.equal(await pruneTrackedUploads(86400000, 1), 1)
      assert.isTrue(await storage.exists('old-second.png'))
      assert.equal(await pruneTrackedUploads(86400000), 1)
      assert.isFalse(await storage.exists('old-second.png'))
      assert.isFalse(await storage.exists('old.png'))
      for (const key of ['used.png', 'fresh.png', 'shared.png', 'page.png'])
        assert.isTrue(await storage.exists(key))
      assert.lengthOf(await db.from('pupitre_uploads').whereNull('consumed_at'), 1)
      await db.connection().schema.dropTable('pupitre_uploads')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('table image lookups are request-local, deduplicated and parallel with missing keys unchanged', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const first = await Post.create({ title: 'First', slug: 'first', status: 'draft' })
      const second = await Post.create({ title: 'Second', slug: 'second', status: 'draft' })
      first.$attributes.cover = ['one.png', 'missing.png', 'one.png']
      second.$attributes.cover = ['one.png', 'two.png']
      let calls = 0
      let active = 0
      let peak = 0
      const fakeDisk = {
        async exists(key: string) {
          calls++
          active++
          peak = Math.max(peak, active)
          await setTimeout(5)
          active--
          return key !== 'missing.png'
        },
        async url(key: string) {
          return `https://cdn.test/${key}`
        },
      }
      const data = await buildTableData(
        {
          columns: [{ kind: 'image', name: 'cover' }],
          filters: [],
          filtersLayout: 'above',
          searchDebounce: 300,
          paginated: [10, 25],
          striped: false,
        },
        [first, second],
        undefined,
        {
          locale: 'en',
          timezone: 'UTC',
          normalized: {},
          rowActions: async () => [],
          rowUrl: () => undefined,
          resolveFileUrl: async (key) => ((await fakeDisk.exists(key)) ? fakeDisk.url(key) : null),
        }
      )
      assert.equal(calls, 3)
      assert.equal(peak, 3)
      assert.deepEqual(data.rows[0].cells.cover, [
        'https://cdn.test/one.png',
        'missing.png',
        'https://cdn.test/one.png',
      ])
    } finally {
      await closeTestApp(fixture)
    }
  })
})
