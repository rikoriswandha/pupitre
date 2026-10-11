import { test } from '@japa/runner'
import { z } from 'zod'
import {
  action,
  actions,
  defineRelationManager,
  defineResource,
  pages,
  table,
} from '../../../index.js'
import { exportJobResponse, pageProps } from '../../../catalog/wire.js'
import type { RealtimeEvent } from '../../../catalog/wire.js'
import type { RealtimeAdapter } from '../../../src/adapters/realtime.js'
import type { JobsAdapter } from '../../../src/adapters/jobs.js'
import type { TenancyAdapter } from '../../../src/definition/tenancy.js'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  fixturePanel,
  fixturePostResource,
  Post,
  PostPolicy,
  User,
} from '../../helpers/app.js'
import type { TestApplication } from '../../helpers/app.js'
import RelationPost from '../../fixtures/models/relation_post.js'
import RelationComment from '../../fixtures/models/relation_comment.js'
import RelationTag from '../../fixtures/models/relation_tag.js'

function memoryTransport() {
  const events: { channel: string; event: RealtimeEvent }[] = []
  const adapter: RealtimeAdapter = {
    driver: 'memory',
    async publish(channel, event) {
      events.push({ channel, event })
    },
  }
  return { adapter, events }
}

function deferredJobs() {
  const handlers = new Map<string, (payload: Record<string, unknown>) => Promise<void>>()
  const queued: { name: string; payload: Record<string, unknown> }[] = []
  const adapter: JobsAdapter = {
    register(name, handler) {
      handlers.set(name, handler)
    },
    async dispatch(name, payload) {
      queued.push({ name, payload })
    },
  }
  async function run(index: number) {
    const job = queued[index]
    if (!job) throw new Error(`Missing queued job ${index}`)
    const handler = handlers.get(job.name)
    if (!handler) throw new Error(`Missing handler ${job.name}`)
    await handler(structuredClone(job.payload))
  }
  return { adapter, queued, run }
}

const tenancy: TenancyAdapter = {
  async resolve(ctx) {
    return ctx.params.tenant === 'acme' ? { id: 1, name: 'Acme', slug: 'acme' } : null
  },
  scope(query, tenant, options) {
    query.where(options.ownership, tenant.id)
  },
  fill(data, tenant) {
    return { ...data, tenantId: tenant.id }
  },
  async listForUser() {
    return [{ id: 1, name: 'Acme', slug: 'acme' }]
  },
}

async function json(
  fixture: TestApplication,
  cookie: string,
  path: string,
  data?: unknown,
  method = 'POST'
) {
  return fetch(`${fixture.baseUrl}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      'Accept': 'application/json',
      'Cookie': cookie,
      'X-Pupitre-Action': '1',
      'Content-Type': 'application/json',
      'Connection': 'close',
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  })
}

async function csv(fixture: TestApplication, cookie: string, path: string, content: string) {
  const body = new FormData()
  body.append('file', new File([content], 'realtime.csv', { type: 'text/csv' }))
  body.append('mapping', JSON.stringify({ title: 'title', slug: 'slug' }))
  return fetch(`${fixture.baseUrl}${path}?action=import`, {
    method: 'POST',
    headers: { 'Cookie': cookie, 'X-Pupitre-Action': '1', 'Connection': 'close' },
    body,
  })
}

test.group('Pupitre realtime publish paths', () => {
  test('sync imports publish one ping for committed rows, none for wholly invalid or denied imports', async ({
    assert,
  }) => {
    const memory = memoryTransport()
    const panel = fixturePanel.resources({
      posts: fixturePostResource.actions({
        header: [
          actions.import().resolveRecord(({ data }) => Post.findBy('slug', String(data.slug))),
        ],
      }),
    })
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { realtime: memory.adapter },
    })
    try {
      const user = await User.create({
        name: 'Import pings',
        email: 'realtime-import-paths@example.test',
      })
      const cookie = await fixture.loginAs(user)
      await Post.create({ title: 'Before', slug: 'existing-ping', status: 'draft', tenantId: 1 })
      const imported = await csv(
        fixture,
        cookie,
        '/admin/posts/import',
        'title,slug\nNew,new-ping\nUpdated,existing-ping\n,invalid-ping\n'
      )
      assert.equal(imported.status, 200, await imported.clone().text())
      const summary = z
        .object({ created: z.number(), updated: z.number(), failed: z.number() })
        .parse(await imported.json())
      assert.deepEqual(summary, { created: 1, updated: 1, failed: 1 })
      assert.deepEqual(memory.events, [
        {
          channel: 'pupitre/admin/resources/posts',
          event: { type: 'pupitre:table', resource: 'posts' },
        },
      ])
      const invalid = await csv(
        fixture,
        cookie,
        '/admin/posts/import',
        'title,slug\n,all-invalid\n'
      )
      assert.equal(invalid.status, 200)
      assert.lengthOf(memory.events, 1)
      denyPolicyAbility('create')
      const denied = await csv(
        fixture,
        cookie,
        '/admin/posts/import',
        'title,slug\nDenied,denied-ping\n'
      )
      assert.equal(denied.status, 403)
      assert.lengthOf(memory.events, 1)
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })

  test('queued bulk and imports publish only from authorized tenant workers, never at dispatch or failure', async ({
    assert,
  }) => {
    const memory = memoryTransport()
    const jobs = deferredJobs()
    const publish = action('publish-queued')
      .async()
      .can('publish')
      .handle(async ({ records }) => {
        for (const record of records ?? [])
          await (record as Post).merge({ status: 'published' }).save()
      })
    const broken = action('broken-queued')
      .async()
      .handle(() => {
        throw new Error('Worker mutation failed')
      })
    const panel = fixturePanel.tenancy({ mode: 'url', adapter: tenancy }).resources({
      posts: fixturePostResource.actions({
        header: [actions.import().async()],
        bulk: [publish, broken, actions.delete().async()],
      }),
    })
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { realtime: memory.adapter, jobs: jobs.adapter },
    })
    try {
      const user = await User.create({
        name: 'Worker pings',
        email: 'realtime-worker-paths@example.test',
      })
      const cookie = await fixture.loginAs(user)
      const row = await Post.create({
        title: 'Worker',
        slug: 'worker-ping',
        status: 'draft',
        tenantId: 1,
      })
      const queued = await json(fixture, cookie, '/admin/acme/posts/actions/publish-queued', {
        ids: [row.id],
      })
      assert.equal(queued.status, 200)
      assert.lengthOf(memory.events, 0)
      denyPolicyAbility('publish')
      await assert.rejects(() => jobs.run(0))
      assert.lengthOf(memory.events, 0)
      allowPolicyAbilities()
      await jobs.run(0)
      assert.deepEqual(memory.events, [
        {
          channel: 'pupitre/admin/tenants/1/resources/posts',
          event: { type: 'pupitre:table', resource: 'posts' },
        },
      ])
      const brokenResponse = await json(
        fixture,
        cookie,
        '/admin/acme/posts/actions/broken-queued',
        { ids: [row.id] }
      )
      assert.equal(brokenResponse.status, 200)
      await assert.rejects(() => jobs.run(1))
      assert.lengthOf(memory.events, 1)
      const imported = await csv(
        fixture,
        cookie,
        '/admin/acme/posts/import',
        'title,slug\nQueued import,queued-import-ping\n'
      )
      assert.equal(imported.status, 200, await imported.clone().text())
      assert.lengthOf(memory.events, 1)
      const importJob = jobs.queued[2]
      if (!importJob) throw new Error('Expected an import job')
      assert.equal(importJob.name, 'pupitre.import')
      const importRow = await fixture.database
        .from('pupitre_exports')
        .where('id', String(importJob.payload.importId))
        .first()
      assert.exists(importRow, JSON.stringify(importJob))
      assert.equal(String(importRow.user_id), String(importJob.payload.userId))
      assert.equal(String(importRow.tenant_id), String(importJob.payload.tenantId))
      await jobs.run(2)
      assert.lengthOf(memory.events, 2)
      assert.equal(memory.events[1]?.channel, 'pupitre/admin/tenants/1/resources/posts')
      const failedImport = await csv(
        fixture,
        cookie,
        '/admin/acme/posts/import',
        'title,slug\nBlocked,queued-denied-import\n'
      )
      assert.equal(failedImport.status, 200)
      denyPolicyAbility('create')
      await assert.rejects(() => jobs.run(3))
      assert.lengthOf(memory.events, 2)
      allowPolicyAbilities()
      const deleted = await json(fixture, cookie, '/admin/acme/posts/actions/delete', {
        ids: [row.id],
      })
      assert.equal(deleted.status, 200)
      assert.lengthOf(memory.events, 2)
      await jobs.run(4)
      assert.lengthOf(memory.events, 3)
      assert.equal(memory.events[2]?.channel, 'pupitre/admin/tenants/1/resources/posts')
      assert.isNull(await Post.find(row.id))
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })

  test('restore, replicate, force-delete and bulk delete each publish one successful ping', async ({
    assert,
  }) => {
    const memory = memoryTransport()
    let restoreAllowed = true
    class BuiltinPolicy extends PostPolicy {
      restore() {
        return restoreAllowed
      }
      forceDelete() {
        return true
      }
      replicate() {
        return true
      }
    }
    const panel = fixturePanel.resources({
      posts: fixturePostResource
        .policy(BuiltinPolicy)
        .softDeletes('deletedAt')
        .actions({
          row: [actions.restore(), actions.forceDelete(), actions.replicate()],
          bulk: [actions.delete()],
        }),
    })
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { realtime: memory.adapter },
    })
    try {
      const user = await User.create({
        name: 'Builtin pings',
        email: 'realtime-builtins@example.test',
      })
      const cookie = await fixture.loginAs(user)
      const row = await Post.create({
        title: 'Builtin',
        slug: 'builtin-ping',
        status: 'draft',
        tenantId: 1,
      })
      const trashed = await json(fixture, cookie, `/admin/posts/${row.id}`, undefined, 'DELETE')
      assert.equal(trashed.status, 200)
      assert.lengthOf(memory.events, 1)
      restoreAllowed = false
      const denied = await json(fixture, cookie, `/admin/posts/${row.id}/actions/restore`, {})
      assert.equal(denied.status, 403)
      assert.lengthOf(memory.events, 1)
      restoreAllowed = true
      const restored = await json(fixture, cookie, `/admin/posts/${row.id}/actions/restore`, {})
      assert.equal(restored.status, 200)
      assert.lengthOf(memory.events, 2)
      const copied = await json(fixture, cookie, `/admin/posts/${row.id}/actions/replicate`, {})
      assert.equal(copied.status, 200, await copied.clone().text())
      assert.lengthOf(memory.events, 3)
      const bulk = await json(fixture, cookie, '/admin/posts/actions/delete', { ids: [row.id] })
      assert.equal(bulk.status, 200)
      assert.lengthOf(memory.events, 4)
      const forced = await json(fixture, cookie, `/admin/posts/${row.id}/actions/force-delete`, {})
      assert.equal(forced.status, 200)
      assert.lengthOf(memory.events, 5)
      assert.isNull(await Post.find(row.id))
      assert.isTrue(
        memory.events.every(
          ({ channel, event }) =>
            channel === 'pupitre/admin/resources/posts' &&
            event.type === 'pupitre:table' &&
            event.resource === 'posts'
        )
      )
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })

  test('relation descriptors and mutations use the tenant-scoped owning resource channel', async ({
    assert,
  }) => {
    const memory = memoryTransport()
    let canUpdate = true
    class ParentPolicy {
      viewAny() {
        return true
      }
      view() {
        return true
      }
      update() {
        return canUpdate
      }
    }
    const comments = defineRelationManager(RelationPost, 'comments')
      .table((builder) => builder.columns([table.text('title')]).poll('10s'))
      .form((schema) => [schema.text('title').required(), schema.text('body').required()])
      .actions({
        header: [actions.create(), actions.associate()],
        row: [actions.edit(), actions.delete(), actions.dissociate()],
      })
    const tags = defineRelationManager(RelationPost, 'tags')
      .table((builder) => builder.columns([table.text('name')]).poll('10s'))
      .actions({ header: [actions.attach()], row: [actions.detach()] })
    const resource = defineResource(RelationPost)
      .slug('relation-posts')
      .policy(ParentPolicy)
      .form((schema) => [schema.text('title').required()])
      .relations([comments, tags])
      .pages({ list: pages.list(), edit: pages.edit() })
    const panel = fixturePanel
      .tenancy({ mode: 'url', adapter: tenancy })
      .resources({ relationPosts: resource })
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { realtime: memory.adapter },
    })
    try {
      const user = await User.create({
        name: 'Relation pings',
        email: 'realtime-relations@example.test',
      })
      const cookie = await fixture.loginAs(user)
      const parent = await RelationPost.create({ title: 'Parent', tenantId: 1 })
      const base = `/admin/acme/relation-posts/${parent.id}`
      const response = await fetch(`${fixture.baseUrl}${base}/edit`, {
        headers: {
          'Cookie': cookie,
          'Accept': 'text/html',
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
        },
      })
      assert.equal(response.status, 200, await response.clone().text())
      const props = z.object({ props: pageProps }).parse(await response.json()).props
      assert.deepEqual(
        props.page.relations?.map(({ table: descriptor }) => descriptor.realtime),
        [
          { channel: 'pupitre/admin/tenants/1/resources/relation-posts' },
          { channel: 'pupitre/admin/tenants/1/resources/relation-posts' },
        ]
      )
      const created = await json(fixture, cookie, `${base}/relations/comments/actions/create`, {
        data: { title: 'Child', body: 'Body' },
      })
      assert.equal(created.status, 200, await created.clone().text())
      assert.lengthOf(memory.events, 1)
      const child = await RelationComment.findByOrFail('title', 'Child')
      canUpdate = false
      const denied = await json(
        fixture,
        cookie,
        `${base}/relations/comments/${child.id}/actions/edit`,
        { data: { title: 'Denied', body: 'Body' } }
      )
      assert.equal(denied.status, 403)
      assert.lengthOf(memory.events, 1)
      canUpdate = true
      const invalid = await json(fixture, cookie, `${base}/relations/comments/actions/create`, {
        data: {},
      })
      assert.equal(invalid.status, 422)
      assert.lengthOf(memory.events, 1)
      const edited = await json(
        fixture,
        cookie,
        `${base}/relations/comments/${child.id}/actions/edit`,
        { data: { title: 'Updated', body: 'Body' } }
      )
      assert.equal(edited.status, 200)
      assert.lengthOf(memory.events, 2)
      const dissociated = await json(
        fixture,
        cookie,
        `${base}/relations/comments/${child.id}/actions/dissociate`,
        { data: {} }
      )
      assert.equal(dissociated.status, 200)
      assert.lengthOf(memory.events, 3)
      const associated = await json(
        fixture,
        cookie,
        `${base}/relations/comments/actions/associate`,
        { data: { ids: [child.id] } }
      )
      assert.equal(associated.status, 200, await associated.clone().text())
      assert.lengthOf(memory.events, 4)
      const deleted = await json(
        fixture,
        cookie,
        `${base}/relations/comments/${child.id}/actions/delete`,
        { data: {} }
      )
      assert.equal(deleted.status, 200)
      assert.lengthOf(memory.events, 5)
      const tag = await RelationTag.create({ name: 'Ping tag', tenantId: 1 })
      const attached = await json(fixture, cookie, `${base}/relations/tags/actions/attach`, {
        data: { ids: [tag.id] },
      })
      assert.equal(attached.status, 200, await attached.clone().text())
      assert.lengthOf(memory.events, 6)
      const detached = await json(
        fixture,
        cookie,
        `${base}/relations/tags/${tag.id}/actions/detach`,
        { data: {} }
      )
      assert.equal(detached.status, 200)
      assert.lengthOf(memory.events, 7)
      assert.isTrue(
        memory.events.every(
          ({ channel, event }) =>
            channel === 'pupitre/admin/tenants/1/resources/relation-posts' &&
            event.type === 'pupitre:table' &&
            event.resource === 'relation-posts'
        )
      )
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('completed queued exports ping the stored inbox once, not the resource table', async ({
    assert,
  }) => {
    const memory = memoryTransport()
    const jobs = deferredJobs()
    let stored = 0
    const originalPublish = memory.adapter.publish
    memory.adapter.publish = async (channel, event) => {
      assert.equal(stored, 1)
      await originalPublish(channel, event)
    }
    let failInbox = false
    const panel = fixturePanel
      .notifications()
      .tenancy({ mode: 'url', adapter: tenancy })
      .resources({
        posts: fixturePostResource.actions({ header: [actions.export()] }),
      })
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: {
        realtime: memory.adapter,
        jobs: jobs.adapter,
        exports: { maxSyncRows: 0 },
        auth: { model: async () => ({ default: User }) },
        notifications: {
          async toInbox() {
            if (failInbox) throw new Error('Inbox storage failed')
            stored++
          },
          async inbox() {
            return { items: [], meta: { total: 0, perPage: 10, currentPage: 1, lastPage: 1 } }
          },
          async unreadCount() {
            return stored
          },
          async markRead() {},
        },
      },
    })
    try {
      const user = await User.create({
        name: 'Export pings',
        email: 'realtime-export-paths@example.test',
      })
      const cookie = await fixture.loginAs(user)
      await Post.create({ title: 'Export', slug: 'export-ping', status: 'draft', tenantId: 1 })
      const response = await json(fixture, cookie, '/admin/acme/posts/export?action=export', {})
      assert.equal(response.status, 200, await response.clone().text())
      const job = exportJobResponse.parse(await response.json())
      assert.lengthOf(memory.events, 0)
      assert.equal(stored, 0)
      denyPolicyAbility('viewAny')
      await assert.rejects(() => jobs.run(0))
      assert.lengthOf(memory.events, 0)
      assert.equal(stored, 0)
      allowPolicyAbilities()
      await jobs.run(0)
      const row = await fixture.database.from('pupitre_exports').where('id', job.jobId).first()
      assert.equal(row.status, 'done')
      assert.equal(stored, 1)
      assert.deepEqual(memory.events, [
        { channel: `pupitre/admin/users/${user.id}`, event: { type: 'pupitre:notification' } },
      ])
      failInbox = true
      const second = await json(fixture, cookie, '/admin/acme/posts/export?action=export', {})
      assert.equal(second.status, 200)
      const secondJob = exportJobResponse.parse(await second.json())
      await jobs.run(1)
      const completed = await fixture.database
        .from('pupitre_exports')
        .where('id', secondJob.jobId)
        .first()
      assert.equal(completed.status, 'done')
      assert.equal(stored, 1)
      assert.lengthOf(memory.events, 1)
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })
})
