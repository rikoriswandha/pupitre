import { test } from '@japa/runner'
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import Audit from '@rikology/adonisjs-audit-trail/models/audit'
import { DateTime } from 'luxon'
import { auditAdapter } from '../../src/drivers/audit.js'
import { setupDatabase, Post } from '../helpers/db.js'
import { ApiClient } from '@japa/api-client'
import { fixturePanel, fixturePostResource, createTestApp, closeTestApp } from '../helpers/app.js'
import { tableData, widgetData } from '../../catalog/wire.js'
import { HttpContext } from '@adonisjs/core/http'

let initializedPeer = false
// Exercise the installed peer's actual generated schema, not a Pupitre-owned substitute.
async function migratePeer() {
  const db = await setupDatabase()
  if (await db.connection().schema.hasTable('audits')) {
    if (!initializedPeer) await db.connection().from('audits').del()
    initializedPeer = true
    return db
  }
  const peer = fileURLToPath(import.meta.resolve('@rikology/adonisjs-audit-trail'))
  const stub = await readFile(
    new URL('stubs/migrations/create_audits_table.stub', pathToFileURL(peer)),
    'utf8'
  )
  const source = stub
    .replace(/^[\s\S]*?\}\}\}/, '')
    .replace(/\{\{#if auditConnection\}\}[\s\S]*?\{\{\/if\}\}/g, '')
    .replace(/\{\{#if immutability\}\}[\s\S]*?\{\{\/if\}\}/g, '')
    .replaceAll('{{ auditTable }}', 'audits')
  const directory = new URL('../../tmp/', import.meta.url)
  await mkdir(directory, { recursive: true })
  const path = new URL(`audit-migration-${randomUUID()}.ts`, directory)
  await writeFile(path, source)
  try {
    const { default: Migration } = await import(path.href)
    await new Migration(db.connection(), path.pathname).execUp()
  } finally {
    await unlink(path)
  }
  initializedPeer = true
  return db
}

test.group('audit adapter', () => {
  test('reports a clear optional peer error without requiring it at adapter creation', async ({
    assert,
  }) => {
    const script = `
      import { registerHooks } from 'node:module'
      registerHooks({ resolve(specifier, context, next) {
        if (specifier === '@rikology/adonisjs-audit-trail/models/audit') {
          throw Object.assign(new Error('missing peer'), { code: 'ERR_MODULE_NOT_FOUND' })
        }
        return next(specifier, context)
      } })
      const { auditAdapter } = await import(${JSON.stringify(new URL('../../src/drivers/audit.ts', import.meta.url).href)})
      const adapter = auditAdapter()
      try { await adapter.forRecord({ name: 'Post' }, 1); process.exitCode = 1 }
      catch (error) { console.log(error.message) }
    `
    const result = await promisify(execFile)(process.execPath, [
      '--import=@poppinss/ts-exec',
      '--input-type=module',
      '-e',
      script,
    ])
    assert.include(result.stdout, 'Pupitre auditAdapter requires @rikology/adonisjs-audit-trail')
  })

  test('normalizes a real peer row and supports morph references without unused recent API', async ({
    assert,
  }) => {
    const db = await migratePeer()
    const id = randomUUID()
    await db
      .connection()
      .table('audits')
      .insert({
        id,
        stream: id,
        seq: 1,
        hash: 'a'.repeat(64),
        prev_hash: '0'.repeat(64),
        event: 'model.updated',
        auditable_type: 'Post',
        auditable_id: '123',
        old_values: JSON.stringify({ title: 'Old', removed: true }),
        new_values: JSON.stringify({ title: 'New', added: 2 }),
        actor_type: 'user',
        actor_id: '7',
        actor_label: 'Ada',
        tags: JSON.stringify(['editor']),
        created_at: '2026-10-11T12:00:00.000Z',
        schema_version: '1',
      })
    const row = await Audit.findOrFail(id)
    assert.isTrue(DateTime.isDateTime(row.createdAt))
    const result = await auditAdapter().forRecord(Post, 123)
    assert.deepEqual(result.items[0], {
      id,
      event: 'model.updated',
      auditableType: 'Post',
      auditableId: '123',
      actor: { type: 'user', id: '7', label: 'Ada' },
      changes: [
        { field: 'title', old: 'Old', new: 'New' },
        { field: 'removed', old: true, new: null },
        { field: 'added', old: null, new: 2 },
      ],
      tags: ['editor'],
      createdAt: '2026-10-11T12:00:00.000Z',
    })
    assert.equal(result.meta.total, 1)
    const aliased = await auditAdapter({ auditableType: () => 'article' }).forRecord(Post, 123)
    assert.equal(aliased.meta.total, 0)
    assert.deepEqual(Object.keys(auditAdapter()), ['forRecord'])
    await assert.rejects(() => auditAdapter().forRecord(Post, 123, { page: 0 }), /positive integer/)
  })

  test('shared record timelines do not leak another tenant audit history', async ({ assert }) => {
    const { audit } = await import('../../../pupitre-audit/index.js')
    const db = await migratePeer()
    const post = await Post.create({
      title: 'Shared',
      slug: randomUUID(),
      status: 'draft',
      tenantId: 1,
    })
    for (const tenant of ['acme', 'globex']) {
      const id = randomUUID()
      await db
        .connection()
        .table('audits')
        .insert({
          id,
          stream: id,
          seq: 1,
          hash: 'a'.repeat(64),
          prev_hash: '0'.repeat(64),
          event: `tenant.${tenant}`,
          auditable_type: 'Post',
          auditable_id: String(post.id),
          tenant_id: tenant,
          actor_type: 'user',
          actor_label: `${tenant} actor`,
          tags: '[]',
          created_at: '2026-10-11T12:00:00.000Z',
          schema_version: '1',
        })
    }
    const adapter = auditAdapter()
    const scoped = await adapter.forRecord(Post, post.id, { tenantId: 'acme' })
    assert.deepEqual(
      scoped.items.map((entry) => entry.event),
      ['tenant.acme']
    )
    const panel = fixturePanel
      .resources({ posts: fixturePostResource.scope(false) })
      .tenancy({
        mode: 'url',
        adapter: {
          async resolve(ctx) {
            const id = String(ctx.params.tenant)
            return { id, slug: id, name: id }
          },
          scope() {},
          fill(data) {
            return data
          },
          async listForUser() {
            return []
          },
        },
      })
      .plugins([audit({ activity: false, pages: ['view'] })])
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { audit: adapter },
    })
    try {
      const response = await new ApiClient(fixture.baseUrl)
        .get(
          `/admin/acme/_pupitre/widgets/audit-posts?resource=posts&widgetPage=view&record=${post.id}`
        )
        .header('Accept', 'application/json')
        .send()
      assert.equal(response.status(), 200, response.text())
      const data = widgetData.parse(response.body())
      if (data.kind !== 'timeline') throw new Error('Expected timeline')
      assert.deepEqual(
        data.items.map((item) => item.title),
        ['tenant.acme']
      )
      assert.notInclude(JSON.stringify(data), 'globex actor')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('activity HTTP list denies by default, allows explicit access, and has no write routes', async ({
    assert,
  }) => {
    // Load the plugin through its source entry so core does not depend on a built workspace.
    const { audit } = await import('../../../pupitre-audit/index.js')
    const db = await migratePeer()
    const row = { id: randomUUID(), event: 'model.created' }
    await db
      .connection()
      .table('audits')
      .insert({
        ...row,
        stream: row.id,
        seq: 1,
        hash: 'a'.repeat(64),
        prev_hash: '0'.repeat(64),
        auditable_type: 'Post',
        auditable_id: 'http-fixture',
        tags: '[]',
        created_at: '2026-10-11T12:00:00.000Z',
        schema_version: '1',
      })
    for (const allowed of [false, true]) {
      const plugin = audit({ resources: [], ...(allowed ? { authorize: () => true } : {}) })
      const fixture = await createTestApp({
        panels: {
          admin: async () => ({
            default: fixturePanel
              .middleware([
                async (ctx, next) => {
                  // Real Adonis hosts install container_bindings_middleware; the fixture does not.
                  ctx.containerResolver.bindValue(HttpContext, ctx)
                  return next()
                },
              ])
              .plugins([plugin]),
          }),
        },
      })
      try {
        const list = await new ApiClient(fixture.baseUrl)
          .get('/admin/activity')
          .header('Accept', allowed ? 'text/html' : 'application/json')
          .header('X-Inertia', 'true')
          .header('X-Inertia-Version', '1')
          .send()
        assert.equal(list.status(), allowed ? 200 : 403, list.text())
        if (allowed) {
          const data = tableData.parse(list.body().props.data)
          assert.isAbove(data.rows.length, 0)
          assert.include(JSON.stringify(data.rows), row.event)
          assert.isString(data.rows[0].cells.createdAt)
          assert.isNotEmpty(data.rows[0].cells.createdAt)
          const malformed = data.rows.find((entry) => {
            const cell = entry.cells.auditableId
            return (
              cell && typeof cell === 'object' && 'value' in cell && cell.value === 'http-fixture'
            )
          })
          assert.exists(malformed)
          const cell = malformed!.cells.auditableId as { value: string; url?: string }
          assert.isUndefined(cell.url)
          const detail = await new ApiClient(fixture.baseUrl)
            .get(`/admin/activity/${row.id}`)
            .header('Accept', 'text/html')
            .header('X-Inertia', 'true')
            .header('X-Inertia-Version', '1')
            .send()
          assert.equal(detail.status(), 200, detail.text())
          assert.notInclude(
            detail.body().props.page.actions.header.map((action: { name: string }) => action.name),
            'delete'
          )
          for (const suffix of [
            'export',
            'import',
            'import/preview',
            'reorder',
            'actions/delete',
          ]) {
            const mutation = await new ApiClient(fixture.baseUrl)
              .post(`/admin/activity/${suffix}`)
              .header('Accept', 'application/json')
              .send()
            assert.include([404, 405], mutation.status(), mutation.text())
          }
          for (const route of ['/admin/activity/create', `/admin/activity/${row.id}/edit`]) {
            const response = await new ApiClient(fixture.baseUrl)
              .get(route)
              .header('Accept', 'application/json')
              .send()
            assert.equal(response.status(), 404, response.text())
          }
          const create = await new ApiClient(fixture.baseUrl)
            .post('/admin/activity')
            .header('Accept', 'application/json')
            .send()
          assert.include([404, 405], create.status(), create.text())
          const update = await new ApiClient(fixture.baseUrl)
            .put(`/admin/activity/${row.id}`)
            .header('Accept', 'application/json')
            .send()
          assert.include([404, 405], update.status(), update.text())
          const remove = await new ApiClient(fixture.baseUrl)
            .delete(`/admin/activity/${row.id}`)
            .header('Accept', 'application/json')
            .send()
          assert.include([404, 405], remove.status(), remove.text())
          const inline = await new ApiClient(fixture.baseUrl)
            .patch(`/admin/activity/${row.id}/column/event`)
            .header('Accept', 'application/json')
            .send()
          assert.include([404, 405], inline.status(), inline.text())
        }
      } finally {
        await closeTestApp(fixture)
      }
    }
  })
})
