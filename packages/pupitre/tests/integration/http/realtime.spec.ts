import { z } from 'zod'
import { pageProps, realtimeEvent, tableDescriptor } from '../../../catalog/wire.js'
import { test } from '@japa/runner'
import { action, definePanel, realtimeChannels, table } from '../../../index.js'
import type { RealtimeAdapter } from '../../../src/adapters/realtime.js'
import type { RealtimeEvent } from '../../../catalog/wire.js'
import {
  createTestApp,
  closeTestApp,
  fixturePostResource,
  fixtureBulkArchiveAction,
  fixturePanel,
  Post,
  User,
  denyPolicyAbility,
  allowPolicyAbilities,
  failFixtureAfterSave,
  resetFixtureHooks,
} from '../../helpers/app.js'

function memoryRealtime() {
  const events: { channel: string; event: RealtimeEvent }[] = []
  let fail = false
  const adapter: RealtimeAdapter = {
    driver: 'memory',
    async publish(channel, event) {
      if (fail) throw new Error('Transport unavailable')
      events.push({ channel, event })
    },
  }
  return {
    adapter,
    events,
    breakTransport() {
      fail = true
    },
  }
}

async function request(base: string, path: string, method = 'GET', body?: unknown, cookie = '') {
  return fetch(`${base}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      'Accept': 'application/json',
      'X-Inertia': 'true',
      'X-Inertia-Version': '1',
      'X-Pupitre-Action': '1',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

test.group('Pupitre realtime', () => {
  test('wire accepts namespaced pings and rejects obsolete event names', ({ assert }) => {
    assert.isTrue(realtimeEvent.safeParse({ type: 'pupitre:notification' }).success)
    assert.isTrue(realtimeEvent.safeParse({ type: 'pupitre:table', resource: 'posts' }).success)
    assert.isFalse(realtimeEvent.safeParse({ type: 'notification' }).success)
    assert.isFalse(realtimeEvent.safeParse({ type: 'table', resource: 'posts' }).success)
  })

  test('encodes individual channel identifiers', ({ assert }) => {
    assert.equal(realtimeChannels.user('a/b', 'x/y'), 'pupitre/a%2Fb/users/x%2Fy')
    assert.equal(
      realtimeChannels.resource('admin', 'posts/x', 'tenant/x'),
      'pupitre/admin/tenants/tenant%2Fx/resources/posts%2Fx'
    )
    assert.equal(
      realtimeChannels.resource('admin', 'posts', 0),
      'pupitre/admin/tenants/0/resources/posts'
    )
  })

  test('publishes inline, reorder, bulk, header and stored inbox pings exactly once', async ({
    assert,
  }) => {
    const memory = memoryRealtime()
    let stored = false
    const resource = fixturePostResource
      .table((builder) => builder.columns([table.toggle('isFeatured')]).reorderable('viewsCount'))
      .actions({
        bulk: [fixtureBulkArchiveAction],
        header: [
          action('inbox').handle(async ({ notify }) => {
            await notify?.success('Stored').sendToDatabase()
          }),
        ],
      })
    const panel = fixturePanel.notifications().resources({ posts: resource })
    const fixture = await createTestApp({
      panels: {
        admin: async () => ({ default: panel }),
        other: async () => ({ default: definePanel('other').path('/other').notifications() }),
        disabled: async () => ({ default: definePanel('disabled').path('/disabled') }),
      },
      pupitre: {
        realtime: memory.adapter,
        notifications: {
          async toInbox() {
            stored = true
          },
          async inbox() {
            return { items: [], meta: { total: 0, perPage: 10, currentPage: 1, lastPage: 1 } }
          },
          async unreadCount() {
            return 0
          },
          async markRead() {},
        },
      },
    })
    try {
      const user = await User.create({
        name: 'Realtime inbox',
        email: 'inbox-realtime@example.test',
      })
      const cookie = await fixture.loginAs(user)
      const row = await Post.create({
        title: 'Ping',
        slug: 'ping-inline',
        status: 'draft',
        tenantId: 1,
      })
      const inline = await request(
        fixture.baseUrl,
        `/admin/posts/${row.id}/column/isFeatured`,
        'PATCH',
        { value: true },
        cookie
      )
      assert.equal(inline.status, 204)
      assert.lengthOf(memory.events, 1)
      const reorder = await request(
        fixture.baseUrl,
        '/admin/posts/reorder',
        'POST',
        { ids: [row.id] },
        cookie
      )
      assert.equal(reorder.status, 204)
      assert.lengthOf(memory.events, 2)
      const bulk = await request(
        fixture.baseUrl,
        '/admin/posts/actions/bulk-archive',
        'POST',
        { ids: [row.id] },
        cookie
      )
      assert.equal(bulk.status, 200)
      assert.lengthOf(memory.events, 3)
      const inbox = await request(fixture.baseUrl, '/admin/posts/actions/inbox', 'POST', {}, cookie)
      assert.equal(inbox.status, 200)
      assert.isTrue(stored)
      assert.deepEqual(memory.events.slice(3), [
        { channel: `pupitre/admin/users/${user.id}`, event: { type: 'pupitre:notification' } },
        { channel: `pupitre/other/users/${user.id}`, event: { type: 'pupitre:notification' } },
        {
          channel: 'pupitre/admin/resources/posts',
          event: { type: 'pupitre:table', resource: 'posts' },
        },
      ])
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('publishes one ping per committed mutation, never for denied or rolled-back mutations', async ({
    assert,
  }) => {
    const memory = memoryRealtime()
    let initialized = false
    memory.adapter.initialize = (manager) => {
      assert.exists(manager.getPanel('admin'))
      initialized = true
    }
    const fixture = await createTestApp({ pupitre: { realtime: async () => memory.adapter } })
    try {
      assert.isTrue(initialized)
      const values = { title: 'Realtime row', slug: 'realtime-row', status: 'draft' }
      const created = await request(fixture.baseUrl, '/admin/posts', 'POST', values)
      assert.equal(created.status, 200)
      const record = await Post.findByOrFail('slug', values.slug)
      assert.lengthOf(memory.events, 1)
      assert.deepEqual(memory.events[0], {
        channel: 'pupitre/admin/resources/posts',
        event: { type: 'pupitre:table', resource: 'posts' },
      })
      denyPolicyAbility('update')
      const denied = await request(fixture.baseUrl, `/admin/posts/${record.id}`, 'PUT', values)
      assert.equal(denied.status, 403)
      assert.lengthOf(memory.events, 1)
      allowPolicyAbilities()
      failFixtureAfterSave()
      const rolledBack = await request(fixture.baseUrl, `/admin/posts/${record.id}`, 'PUT', {
        ...values,
        title: 'Rollback',
      })
      assert.equal(rolledBack.status, 500)
      assert.lengthOf(memory.events, 1)
      resetFixtureHooks()
      const updated = await request(fixture.baseUrl, `/admin/posts/${record.id}`, 'PUT', values)
      assert.equal(updated.status, 200)
      assert.lengthOf(memory.events, 2)
      const archived = await request(
        fixture.baseUrl,
        `/admin/posts/${record.id}/actions/archive`,
        'POST',
        {
          data: { reason: 'Realtime archive' },
        }
      )
      assert.equal(archived.status, 200)
      assert.lengthOf(memory.events, 3)
      memory.breakTransport()
      const deleted = await request(fixture.baseUrl, `/admin/posts/${record.id}`, 'DELETE')
      assert.equal(deleted.status, 200)
      assert.isNull(await Post.find(record.id))
      assert.lengthOf(memory.events, 3)
    } finally {
      allowPolicyAbilities()
      resetFixtureHooks()
      await closeTestApp(fixture)
    }
  })

  test('shares realtime only for authenticated users and scopes list channels to the tenant', async ({
    assert,
  }) => {
    const memory = memoryRealtime()
    const panel = fixturePanel
      .tenancy({
        mode: 'url',
        adapter: {
          async resolve(ctx) {
            return { id: Number(ctx.params.tenant), name: 'Tenant' }
          },
          scope(query, tenant, options) {
            query.where(options.ownership, tenant.id)
          },
          fill(data, tenant) {
            return { ...data, tenantId: tenant.id }
          },
          async listForUser() {
            return [
              { id: 1, name: 'One' },
              { id: 2, name: 'Two' },
            ]
          },
        },
      })
      .resources({ posts: fixturePostResource.scope(() => {}) })
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { realtime: memory.adapter },
    })
    try {
      const anonymous = await request(fixture.baseUrl, '/admin/1/posts')
      const anonymousPage = z.object({ props: pageProps }).parse(await anonymous.json())
      assert.notExists(anonymousPage.props.pupitre.realtime)
      const user = await User.create({
        email: 'realtime@example.com',
        password: 'secret',
        fullName: 'Realtime',
        name: 'Realtime',
      })
      const cookie = await fixture.loginAs(user)
      const response = await request(fixture.baseUrl, '/admin/2/posts', 'GET', undefined, cookie)
      const page = z.object({ props: pageProps }).parse(await response.json())
      assert.deepEqual(page.props.pupitre.realtime, {
        driver: 'memory',
        userChannel: `pupitre/admin/users/${user.id}`,
      })
      const descriptor = tableDescriptor.parse(
        page.props.page.spec.elements.table?.props.descriptor
      )
      assert.deepEqual(descriptor.realtime, {
        channel: 'pupitre/admin/tenants/2/resources/posts',
      })
      const created = await request(
        fixture.baseUrl,
        '/admin/2/posts',
        'POST',
        { title: 'Tenant ping', slug: 'tenant-ping', status: 'draft' },
        cookie
      )
      assert.equal(created.status, 200)
      assert.deepEqual(
        memory.events.map(({ channel }) => channel),
        ['pupitre/admin/tenants/2/resources/posts']
      )
    } finally {
      await closeTestApp(fixture)
    }
  })
})
