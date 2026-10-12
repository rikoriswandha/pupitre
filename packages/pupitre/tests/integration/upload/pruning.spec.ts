import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { definePanel, defineResource, schema } from '../../../index.js'
import { createTestApp, closeTestApp, Post, type TestApplication } from '../../helpers/app.js'
import { createPupitreStorage, uploadFields } from '../../../src/storage/index.js'
import { cleanupRecordFiles } from '../../../src/storage/record_files.js'
import {
  consumeFormUploads,
  pruneTrackedUploads,
  uploadDatabase,
} from '../../../src/storage/upload_tracking.js'
import PruneUploads from '../../../commands/prune_uploads.js'

const uploadContext = (key: string) =>
  ({
    session: { get: () => [{ resource: 'posts', field: 'cover', key }] },
  }) as unknown as HttpContext
const form = [schema.fileUpload('cover').toDefinition()]

async function tracker(fixture: TestApplication, keys: string[]) {
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
  for (const key of keys) {
    await storage.put(key, Buffer.from('bytes'), { contentType: 'image/png', visibility: 'public' })
    await db.table('pupitre_uploads').insert({
      key,
      owner: 'session',
      panel: 'admin',
      resource: 'posts',
      field: 'cover',
      created_at: 0,
      consumed_at: null,
    })
  }
  return { db, storage }
}

test.group('batched upload pruning regressions', () => {
  test('one upload walker preserves nested paths and relationship boundaries', ({ assert }) => {
    const fields = uploadFields([
      schema.fileUpload('cover').toDefinition(),
      schema
        .section('Files')
        .components([schema.fileUpload('privateCover')])
        .toDefinition(),
      schema
        .repeater('items')
        .schema([schema.fileUpload('attachment')])
        .toDefinition(),
      schema
        .repeater('links')
        .relationship('links')
        .schema([schema.fileUpload('attachment')])
        .toDefinition(),
    ])
    assert.deepEqual(
      fields.map(({ name, relationshipPath }) => ({ name, relationshipPath })),
      [
        { name: 'cover', relationshipPath: undefined },
        { name: 'privateCover', relationshipPath: undefined },
        { name: 'items.attachment', relationshipPath: undefined },
        { name: 'links.attachment', relationshipPath: 'links' },
      ]
    )
  })

  test('a save consuming a selected candidate before its claim keeps its bytes', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const { db, storage } = await tracker(fixture, ['race.png'])
      const knex = db.connection().getWriteClient()
      const original = knex.client.query
      let consumed = false
      knex.client.query = async function (connection: unknown, query: { sql: string }) {
        if (!consumed && /select.*from ["`]posts["`]/i.test(query.sql)) {
          consumed = true
          const reservation = knex('pupitre_uploads')
            .where('key', 'race.png')
            .update({ consumed_at: Date.now() })
            .toSQL()
          await original.call(this, connection, reservation)
        }
        return original.call(this, connection, query)
      }
      try {
        assert.equal(await pruneTrackedUploads(1), 0)
        assert.isTrue(consumed)
        assert.isTrue(await storage.exists('race.png'))
      } finally {
        knex.client.query = original
      }
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('claimed uploads cannot be adopted while storage deletion is in flight', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const { storage } = await tracker(fixture, ['claimed.png'])
      const drive = await fixture.app.container.make('drive.manager')
      const disk = drive.use()
      const original = disk.delete
      disk.delete = async (key) => {
        await assert.rejects(() =>
          consumeFormUploads(uploadContext(key), 'posts', form, { cover: key })
        )
        await original.call(disk, key)
      }
      try {
        assert.equal(await pruneTrackedUploads(1), 1)
        assert.isFalse(await storage.exists('claimed.png'))
      } finally {
        disk.delete = original
      }
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('relationship repeater files are conservatively retained without parent-column queries', async ({
    assert,
  }) => {
    const panel = definePanel('admin')
      .path('/admin')
      .resources([
        defineResource(Post).form((fields) => [
          fields
            .repeater('links')
            .relationship('links')
            .schema([schema.fileUpload('attachment')]),
        ]),
      ])
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const { db, storage } = await tracker(fixture, ['related.png'])
      await db
        .from('pupitre_uploads')
        .where('key', 'related.png')
        .update({ field: 'links.attachment' })
      let failures = 0
      assert.equal(
        await pruneTrackedUploads(1, 100, () => {
          failures++
        }),
        0
      )
      assert.equal(failures, 0)
      assert.isTrue(await storage.exists('related.png'))
      const retained = await db.from('pupitre_uploads').where('key', 'related.png').first()
      assert.isNull(retained.consumed_at)
      const messages: string[] = []
      const command = Object.create(PruneUploads.prototype) as PruneUploads
      Object.defineProperties(command, {
        olderThan: { value: '24h' },
        logger: {
          value: {
            error() {},
            info(message: string) {
              messages.push(message)
            },
          },
        },
        exitCode: { writable: true, value: 0 },
      })
      await command.run()
      assert.equal(command.exitCode, 0)
      assert.deepEqual(messages, [
        'Pruned 0 abandoned uploads; skipped 1 conservatively retained uploads',
      ])
      const stillRetained = await db.from('pupitre_uploads').where('key', 'related.png').first()
      assert.isNull(stillRetained.consumed_at)
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('pruning pages past more than its limit of retained relationship uploads', async ({
    assert,
  }) => {
    const panel = definePanel('admin')
      .path('/admin')
      .resources([
        defineResource(Post).form(() => [
          schema.fileUpload('cover'),
          schema
            .repeater('links')
            .relationship('links')
            .schema([schema.fileUpload('attachment')]),
        ]),
      ])
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      // Equal timestamps exercise the key tie-breaker across page boundaries.
      const retainedKeys = ['related-a.png', 'related-b.png', 'related-c.png']
      const { db, storage } = await tracker(fixture, [...retainedKeys, 'abandoned.png'])
      await db
        .from('pupitre_uploads')
        .whereIn('key', retainedKeys)
        .update({ field: 'links.attachment' })
      await db.from('pupitre_uploads').where('key', 'abandoned.png').update({ created_at: 1 })
      const skipped: string[] = []
      const errors: unknown[] = []
      assert.equal(
        await pruneTrackedUploads(
          1,
          2,
          (error) => errors.push(error),
          (key) => skipped.push(key)
        ),
        1
      )
      assert.deepEqual(errors, [])
      assert.deepEqual(skipped, retainedKeys)
      assert.isFalse(await storage.exists('abandoned.png'))
      assert.isNull(await db.from('pupitre_uploads').where('key', 'abandoned.png').first())
      for (const key of retainedKeys) {
        assert.isTrue(await storage.exists(key))
        const retained = await db.from('pupitre_uploads').where('key', key).first()
        assert.isNull(retained.consumed_at)
        assert.equal(Number(retained.created_at), 0)
      }
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('pruning caps examined rows at ten times the processing limit', async ({ assert }) => {
    const panel = definePanel('admin')
      .path('/admin')
      .resources([
        defineResource(Post).form(() => [
          schema.fileUpload('cover'),
          schema
            .repeater('links')
            .relationship('links')
            .schema([schema.fileUpload('attachment')]),
        ]),
      ])
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const retainedKeys = Array.from({ length: 21 }, (_, index) => `related-${index}.png`)
      const { db, storage } = await tracker(fixture, [...retainedKeys, 'abandoned.png'])
      await db
        .from('pupitre_uploads')
        .whereIn('key', retainedKeys)
        .update({ field: 'links.attachment' })
      await db.from('pupitre_uploads').where('key', 'abandoned.png').update({ created_at: 1 })
      const skipped: string[] = []
      assert.equal(
        await pruneTrackedUploads(
          1,
          2,
          () => assert.fail('unexpected prune error'),
          (key) => skipped.push(key)
        ),
        0
      )
      assert.equal(skipped.length, 20)
      assert.equal(new Set(skipped).size, 20)
      assert.isTrue(await storage.exists('abandoned.png'))
      const remaining = await db.from('pupitre_uploads')
      assert.lengthOf(remaining, 22)
      assert.isTrue(remaining.every((upload) => upload.consumed_at === null))
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('pruning stops after its non-skipped processing limit even when claims remove cursor rows', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const { db, storage } = await tracker(fixture, ['a.png', 'b.png', 'c.png'])
      await db.from('pupitre_uploads').where('key', 'a.png').update({ field: 'removed-field' })
      const skipped: string[] = []
      assert.equal(
        await pruneTrackedUploads(
          1,
          1,
          () => assert.fail('unexpected prune error'),
          (key) => skipped.push(key)
        ),
        1
      )
      assert.deepEqual(skipped, ['a.png'])
      assert.isTrue(await storage.exists('a.png'))
      assert.isFalse(await storage.exists('b.png'))
      assert.isTrue(await storage.exists('c.png'))
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('unrelated relationship fields do not retain abandoned uploads and stale claims retry', async ({
    assert,
  }) => {
    const panel = definePanel('admin')
      .path('/admin')
      .resources([
        defineResource(Post)
          .slug('posts')
          .form(() => [schema.fileUpload('cover')]),
        defineResource(Post)
          .slug('related')
          .form(() => [
            schema
              .repeater('links')
              .relationship('links')
              .schema([schema.fileUpload('attachment')]),
          ]),
      ])
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const { db, storage } = await tracker(fixture, ['abandoned.png', 'stale.png', 'active.png'])
      await db.from('pupitre_uploads').where('key', 'stale.png').update({ consumed_at: -1 })
      await db
        .from('pupitre_uploads')
        .where('key', 'active.png')
        .update({ consumed_at: -1, created_at: Date.now() })
      assert.equal(await pruneTrackedUploads(1000), 2)
      assert.isFalse(await storage.exists('abandoned.png'))
      assert.isFalse(await storage.exists('stale.png'))
      assert.isTrue(await storage.exists('active.png'))
      const remaining = await db.from('pupitre_uploads')
      assert.deepEqual(
        remaining.map((upload) => upload.key),
        ['active.png']
      )
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('field-query failures do not abort remaining field reads and command exits non-zero', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const { db, storage } = await tracker(fixture, ['error.png', 'next.png'])
      await db.from('pupitre_uploads').where('key', 'next.png').update({ field: 'privateCover' })
      const knex = db.connection().getReadClient()
      const original = knex.client.query
      let readsAfterError = 0
      let failed = false
      knex.client.query = async function (connection: unknown, query: { sql: string }) {
        if (/select.*from ["`]posts["`]/i.test(query.sql)) {
          if (!failed) {
            failed = true
            throw new Error('injected field query failure')
          }
          readsAfterError++
        }
        return original.call(this, connection, query)
      }
      try {
        const command = Object.create(PruneUploads.prototype) as PruneUploads
        Object.defineProperties(command, {
          olderThan: { value: '24h' },
          logger: { value: { error() {}, info() {} } },
          exitCode: { writable: true, value: 0 },
        })
        await command.run()
        assert.equal(command.exitCode, 1)
        assert.isFalse(await storage.exists('next.png'))
        assert.isAbove(readsAfterError, 0)
        assert.isTrue(await storage.exists('error.png'))
        const upload = await db.from('pupitre_uploads').where('key', 'error.png').first()
        assert.isNull(upload.consumed_at)
      } finally {
        knex.client.query = original
      }
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('bulk cleanup batches scalar and nested keys while keeping cross-tenant soft-deleted references', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const db = await fixture.app.container.make('lucid.db')
      const storage = createPupitreStorage()
      const records = []
      for (let index = 0; index < 8; index++) {
        const key = `bulk-${index}.png`
        await storage.put(key, Buffer.from('bytes'), {
          contentType: 'image/png',
          visibility: 'public',
        })
        await storage.put(`nested-${index}.png`, Buffer.from('bytes'), {
          contentType: 'image/png',
          visibility: 'public',
        })
        records.push(
          new Post().fill({ cover: key, metadata: { attachments: [`nested-${index}.png`] } })
        )
      }
      await Post.create({
        title: 'Retained',
        slug: 'retained',
        status: 'draft',
        tenantId: 999,
        deletedAt: DateTime.now(),
        cover: 'bulk-0.png',
        metadata: { attachments: ['nested-0.png'] },
      })
      const knex = db.connection().getReadClient()
      let reads = 0
      const onQuery = (query: { sql: string }) => {
        if (/select.*from ["`]posts["`]/i.test(query.sql)) reads++
      }
      knex.on('query', onQuery)
      try {
        await cleanupRecordFiles(
          [...form, schema.fileUpload('metadata.attachments').multiple().toDefinition()],
          records
        )
        assert.equal(reads, 2)
        assert.isTrue(await storage.exists('bulk-0.png'))
        assert.isTrue(await storage.exists('nested-0.png'))
        for (let index = 1; index < 8; index++) {
          assert.isFalse(await storage.exists(`bulk-${index}.png`))
          assert.isFalse(await storage.exists(`nested-${index}.png`))
        }
      } finally {
        knex.removeListener('query', onQuery)
      }
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('prune reference checks batch every candidate in one scalar query per field', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const { db } = await tracker(
        fixture,
        Array.from({ length: 8 }, (_, index) => `prune-${index}.png`)
      )
      const knex = db.connection().getReadClient()
      let reads = 0
      const onQuery = (query: { sql: string }) => {
        if (/select.*from ["`]posts["`]/i.test(query.sql)) reads++
      }
      knex.on('query', onQuery)
      try {
        assert.equal(await pruneTrackedUploads(1), 8)
        assert.equal(reads, 1)
      } finally {
        knex.removeListener('query', onQuery)
      }
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('non-upload saves and sessions owned by another form never probe tracking; positive probes are cached', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const { db } = await tracker(fixture, [])
      const knex = db.connection().getReadClient()
      let queries = 0
      const onQuery = () => {
        queries++
      }
      knex.on('query', onQuery)
      try {
        await consumeFormUploads(
          uploadContext('unused.png'),
          'posts',
          [schema.text('title').toDefinition()],
          { title: 'Saved' }
        )
        await consumeFormUploads(uploadContext('unused.png'), 'other', form, {
          cover: 'unused.png',
        })
        assert.equal(queries, 0)
        await uploadDatabase()
        const afterFirstProbe = queries
        assert.isAbove(afterFirstProbe, 0)
        await uploadDatabase()
        assert.equal(queries, afterFirstProbe)
      } finally {
        knex.removeListener('query', onQuery)
      }
    } finally {
      await closeTestApp(fixture)
    }
  })
})
