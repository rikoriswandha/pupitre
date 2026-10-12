import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import { action, definePanel, defineResource, pages, schema } from '../../../index.js'
import { closeTestApp, createTestApp, Post } from '../../helpers/app.js'
import { createPupitreStorage } from '../../../src/storage/index.js'
import { pruneTrackedUploads } from '../../../src/storage/upload_tracking.js'
import User from '../../fixtures/models/user.js'
import { testSessionAuthentication } from '../../helpers/app.js'

class CreateOnlyPolicy {
  create() {
    return true
  }
  viewAny() {
    return false
  }
}

test('create-only users can show and run field actions but not header actions', async ({
  assert,
}) => {
  let runs = 0
  const fieldAction = action('field')
    .form([schema.text('value')])
    .handle(() => {
      runs++
    })
  const header = action('header')
    .form([schema.text('value')])
    .handle(() => {
      runs++
    })
  const shared = action('shared')
    .form([schema.text('value')])
    .handle(() => {
      runs++
    })
  const posts = defineResource(Post)
    .slug('posts')
    .policy(CreateOnlyPolicy)
    .form(() => [schema.text('title').prefixAction(fieldAction).suffixAction(shared)])
    .actions({ header: [header, shared] })
    .pages({ list: pages.list(), create: pages.create() })
  const fixture = await createTestApp({
    panels: {
      admin: async () => ({ default: definePanel('admin').path('/admin').resources({ posts }) }),
    },
  })
  try {
    for (const method of ['GET', 'POST'])
      for (const name of ['field', 'header', 'shared']) {
        const response = await fetch(`${fixture.baseUrl}/admin/posts/actions/${name}`, {
          method,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Pupitre-Action': '1',
          },
          ...(method === 'POST' ? { body: JSON.stringify({ data: { value: 'Value' } }) } : {}),
        })
        assert.equal(
          response.status,
          name === 'field' ? 200 : 403,
          `${method} ${name}: ${await response.text()}`
        )
      }
    assert.equal(runs, 1)
  } finally {
    await closeTestApp(fixture)
  }
})

test('modal create and edit reserve inline editor uploads before persistence', async ({
  assert,
}) => {
  const posts = defineResource(Post)
    .slug('posts')
    .form(() => [schema.markdownEditor('title').required(), schema.text('slug').required()])
    .pages({ list: pages.list().modals() })
  const panel = definePanel('admin')
    .path('/admin')
    .middleware([
      async (ctx: HttpContext, next) => {
        ctx.session.put('pupitre.uploads', [
          { resource: 'posts', field: 'title', key: ctx.request.header('x-upload-key') },
        ])
        return next()
      },
    ])
    .resources({ posts })
  const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
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
    for (const key of ['modal-create.png', 'modal-edit.png']) {
      await storage.put(key, Buffer.from('bytes'), {
        contentType: 'image/png',
        visibility: 'public',
      })
      await db.table('pupitre_uploads').insert({
        key,
        disk: null,
        owner: 'session',
        panel: 'admin',
        resource: 'posts',
        field: 'title',
        created_at: 0,
        consumed_at: null,
      })
    }
    for (const kind of ['create', 'edit']) {
      const record =
        kind === 'edit'
          ? await Post.query().where('slug', 'modal-created').firstOrFail()
          : undefined
      const key = `modal-${kind}.png`
      const response = await fetch(
        `${fixture.baseUrl}/admin/posts${record ? `/${record.id}` : ''}/actions/${kind}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Pupitre-Action': '1',
            'X-Upload-Key': key,
          },
          body: JSON.stringify({
            data: { title: `![image](${key})`, slug: 'modal-created' },
          }),
        }
      )
      assert.equal(response.status, 200, await response.text())
      const tracked = await db.from('pupitre_uploads').where('key', key).first()
      assert.isNotNull(tracked.consumed_at)
      assert.equal(await pruneTrackedUploads(86400000), kind === 'create' ? 1 : 0)
      assert.isTrue(await storage.exists(key))
      const saved = await Post.query().where('slug', 'modal-created').firstOrFail()
      assert.equal(saved.title, `![image](${key})`)
      if (kind === 'create') {
        await storage.put('modal-edit.png', Buffer.from('bytes'), {
          contentType: 'image/png',
          visibility: 'public',
        })
        await db.table('pupitre_uploads').insert({
          key: 'modal-edit.png',
          disk: null,
          owner: 'session',
          panel: 'admin',
          resource: 'posts',
          field: 'title',
          created_at: 0,
          consumed_at: null,
        })
      }
    }
  } finally {
    await closeTestApp(fixture)
  }
})

for (const queued of [false, true]) {
  test(`action editor uploads reserve after validation and before ${queued ? 'enqueue' : 'handling'}`, async ({
    assert,
  }) => {
    let handled = false
    const persist = action('persist')
      .form([schema.markdownEditor('title').required()])
      .async(queued)
      .handle(async ({ ctx }) => {
        if (!ctx) throw new Error('Action context is required')
        const db = await ctx.containerResolver.make('lucid.db')
        const upload = await db.from('pupitre_uploads').where('key', 'action.png').first()
        assert.isNotNull(upload.consumed_at)
        handled = true
      })
    const panel = definePanel('admin')
      .path('/admin')
      .middleware([
        testSessionAuthentication,
        async (ctx: HttpContext, next) => {
          ctx.session.put('pupitre.uploads', [
            { resource: 'posts', field: 'title', key: 'action.png' },
          ])
          return next()
        },
      ])
      .resources([
        defineResource(Post)
          .slug('posts')
          .actions(queued ? { bulk: [persist] } : { header: [persist] }),
      ])
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      ...(queued
        ? {
            pupitre: {
              jobs: {
                register() {},
                async dispatch() {
                  const db = await fixture.app.container.make('lucid.db')
                  const upload = await db.from('pupitre_uploads').where('key', 'action.png').first()
                  assert.isNotNull(upload.consumed_at)
                  handled = true
                },
              },
            },
          }
        : {}),
    })
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
      await db.table('pupitre_uploads').insert({
        key: 'action.png',
        owner: 'session',
        panel: 'admin',
        resource: 'posts',
        field: 'title',
        created_at: 0,
        consumed_at: null,
      })
      const user = await User.create({ name: 'Uploader', email: `action-${queued}@test.dev` })
      const cookie = await fixture.loginAs(user)
      const post = await Post.create({
        title: 'Selected',
        slug: `action-${queued}`,
        status: 'draft',
      })
      for (const valid of [false, true]) {
        const response = await fetch(`${fixture.baseUrl}/admin/posts/actions/persist`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Pupitre-Action': '1',
            'Cookie': cookie,
          },
          body: JSON.stringify({
            ids: [post.id],
            data: valid ? { title: '![image](action.png)' } : {},
          }),
        })
        const text = await response.text()
        assert.equal(response.status, valid ? 200 : 422, text)
        if (!valid) {
          // The action modal maps field errors only from a keyed object, not Adonis' default array.
          const body: unknown = JSON.parse(text)
          assert.isTrue(typeof body === 'object' && body !== null && 'errors' in body, text)
          const errors =
            typeof body === 'object' && body !== null && 'errors' in body ? body.errors : null
          assert.isTrue(
            typeof errors === 'object' && errors !== null && !Array.isArray(errors),
            text
          )
          assert.property(errors, 'title', text)
        }
        assert.equal(handled, valid)
        const upload = await db.from('pupitre_uploads').where('key', 'action.png').first()
        if (valid) assert.isNotNull(upload.consumed_at)
        else assert.isNull(upload.consumed_at)
      }
    } finally {
      await closeTestApp(fixture)
    }
  })
}
