import { test } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'
import type { HttpContext } from '@adonisjs/core/http'
import { BaseModel } from '@adonisjs/lucid/orm'
import { PupitreManager, definePanel, defineResource, realtimeChannels } from '@rikology/pupitre'
import type { RealtimeEvent } from '@rikology/pupitre/catalog'
import { transmitRealtime } from '../index.js'
import type { TransmitService } from '../index.js'

class Post extends BaseModel {}
function fixture() {
  const callbacks: Record<
    string,
    (ctx: HttpContext, params: Record<string, string>) => boolean | Promise<boolean>
  > = {}
  const published: { channel: string; event: RealtimeEvent }[] = []
  const service: TransmitService = {
    broadcast(channel, event) {
      published.push({ channel, event })
    },
    authorize(channel, callback) {
      callbacks[channel] = callback
    },
  }
  const manager = new PupitreManager({} as never)
  const panel = definePanel('admin').path('/admin').guard('web').toDefinition()
  manager.panels.push({ ...panel, resources: [], pages: [], widgets: [] })
  const ctx = {
    auth: {
      user: { $primaryKeyValue: 7 },
      async authenticateUsing(guards: string[]) {
        if (guards[0] !== 'web') throw new Error('Wrong guard')
        this.user = { $primaryKeyValue: 42 }
        return this.user
      },
    },
  } as unknown as HttpContext
  return { adapter: transmitRealtime({ service }), callbacks, published, manager, ctx }
}

test('broadcasts the unchanged ping through Transmit', async ({ assert }) => {
  const { adapter, published } = fixture()
  await adapter.publish('pupitre/admin/resources/posts', {
    type: 'pupitre:table',
    resource: 'posts',
  })
  assert.deepEqual(published, [
    {
      channel: 'pupitre/admin/resources/posts',
      event: { type: 'pupitre:table', resource: 'posts' },
    },
  ])
})

test('registers the core channel patterns and reflects core channel changes', async ({
  assert,
}) => {
  const original = realtimeChannels.patterns.user
  try {
    realtimeChannels.patterns.user = 'changed/:panel/users/:id'
    const { adapter, callbacks, manager, ctx } = fixture()
    await adapter.initialize!(manager)
    assert.deepEqual(Object.keys(callbacks), Object.values(realtimeChannels.patterns))
    const channel = realtimeChannels.user('admin', 42)
    assert.equal(channel, 'changed/admin/users/42')
    const parts = channel.split('/')
    assert.isTrue(
      await callbacks[realtimeChannels.patterns.user](ctx, {
        panel: parts[1],
        id: parts[3],
      })
    )
  } finally {
    realtimeChannels.patterns.user = original
  }
})

test('registers private channels and enforces panel guard and user identity', async ({
  assert,
}) => {
  const { adapter, callbacks, manager, ctx } = fixture()
  await adapter.initialize!(manager)
  assert.lengthOf(Object.keys(callbacks), 3)
  const authorize = callbacks['pupitre/:panel/users/:id']
  assert.isTrue(await authorize(ctx, { panel: 'admin', id: '42' }))
  assert.isFalse(await authorize(ctx, { panel: 'admin', id: '43' }))
  assert.isFalse(await authorize(ctx, { panel: 'missing', id: '42' }))
  const anonymous = {
    auth: {
      async authenticateUsing() {
        throw new Error('Unauthenticated')
      },
    },
  } as unknown as HttpContext
  assert.isFalse(await authorize(anonymous, { panel: 'admin', id: '42' }))
})

test('host-auth panels use the authenticated host principal', async ({ assert }) => {
  const { adapter, callbacks, manager, ctx } = fixture()
  manager.panels[0].guard = undefined
  await adapter.initialize!(manager)
  const check = callbacks['pupitre/:panel/users/:id']
  assert.isTrue(await check(ctx, { panel: 'admin', id: '7' }))
  assert.isFalse(await check(ctx, { panel: 'admin', id: '42' }))
})

test('rejects missing resources and cross-tenant subscriptions', async ({ assert }) => {
  const { adapter, callbacks, manager, ctx } = fixture()
  const panel = manager.panels[0]
  const definition = defineResource(Post).toDefinition()
  panel.resources.push({ slug: 'posts', definition } as never)
  panel.tenancy = {
    mode: 'url',
    ownership: 'tenant_id',
    slugAttribute: 'slug',
    titleAttribute: 'name',
    menu: true,
    currentTenantAttribute: 'currentTenantId',
    adapter: {
      listForUser: async () => [{ id: 'team/a', name: 'A' }],
      resolve: async () => null,
      scope() {},
      fill: (data) => data,
    },
  }
  await adapter.initialize!(manager)
  const scoped = callbacks['pupitre/:panel/tenants/:tenant/resources/:resource']
  assert.isFalse(await scoped(ctx, { panel: 'admin', tenant: 'other', resource: 'posts' }))
  assert.isFalse(await scoped(ctx, { panel: 'admin', tenant: 'team%2Fa', resource: 'missing' }))
  assert.isFalse(
    await callbacks['pupitre/:panel/resources/:resource'](ctx, {
      panel: 'admin',
      resource: 'posts',
    })
  )
  assert.isUndefined(ctx.pupitre)
})

test('allows tenant members only when resource viewAny allows access', async ({
  assert,
  cleanup,
}) => {
  const app = new IgnitorFactory()
    .withCoreConfig()
    .withCoreProviders()
    .create(new URL('../tmp/app/', import.meta.url))
    .createApp('web')
  await app.init()
  await app.boot()
  cleanup(() => app.terminate())
  const { adapter, callbacks, manager, ctx } = fixture()
  class Policy {
    viewAny() {
      return true
    }
  }
  const definition = defineResource(Post).policy(Policy).toDefinition()
  manager.panels[0].resources.push({ slug: 'posts', definition } as never)
  Object.assign(ctx, {
    bouncer: { with: () => ({ allows: async () => true }) },
  })
  await adapter.initialize!(manager)
  const check = callbacks['pupitre/:panel/resources/:resource']
  assert.isTrue(await check(ctx, { panel: 'admin', resource: 'posts' }))
  Object.assign(ctx, { bouncer: { with: () => ({ allows: async () => false }) } })
  assert.isFalse(await check(ctx, { panel: 'admin', resource: 'posts' }))
  Object.assign(ctx, { bouncer: { with: () => ({ allows: async () => true }) } })
  manager.panels[0].tenancy = {
    mode: 'url',
    ownership: 'tenant_id',
    slugAttribute: 'slug',
    titleAttribute: 'name',
    menu: true,
    currentTenantAttribute: 'currentTenantId',
    adapter: {
      listForUser: async () => [{ id: 'team/a', name: 'A' }],
      resolve: async () => null,
      scope() {},
      fill: (data) => data,
    },
  }
  const scoped = callbacks['pupitre/:panel/tenants/:tenant/resources/:resource']
  assert.isTrue(await scoped(ctx, { panel: 'admin', tenant: 'team%2Fa', resource: 'posts' }))
  assert.isFalse(await scoped(ctx, { panel: 'admin', tenant: 'other', resource: 'posts' }))
  assert.isUndefined(ctx.pupitre)
})

test('channel subscriptions respect panel email verification and required MFA', async ({
  assert,
}) => {
  const { adapter, callbacks, manager, ctx } = fixture()
  manager.panels[0].guard = undefined
  manager.panels[0].auth.emailVerification = true
  manager.panels[0].auth.mfa = { required: true, issuer: 'Pupitre' }
  const user: Record<string, unknown> = { $primaryKeyValue: 7 }
  Object.assign(ctx, {
    auth: { user },
    containerResolver: {
      make: async () => ({
        auth: { columns: { emailVerifiedAt: 'verified', mfaEnabledAt: 'mfa' } },
      }),
    },
  })
  await adapter.initialize!(manager)
  const check = callbacks['pupitre/:panel/users/:id']
  assert.isFalse(await check(ctx, { panel: 'admin', id: '7' }))
  user.verified = '2026-10-11'
  assert.isFalse(await check(ctx, { panel: 'admin', id: '7' }))
  user.mfa = '2026-10-11'
  assert.isTrue(await check(ctx, { panel: 'admin', id: '7' }))
})

test('malformed channel parameters deny access without replacing request context', async ({
  assert,
}) => {
  const { adapter, callbacks, manager, ctx } = fixture()
  const previous = { marker: 'original' }
  Object.assign(ctx, { pupitre: previous })
  await adapter.initialize!(manager)
  for (const params of [
    { panel: '%invalid', id: '42' },
    { panel: 'admin', id: '%invalid' },
    { panel: 'admin', id: '42%2F43' },
  ])
    assert.isFalse(await callbacks['pupitre/:panel/users/:id'](ctx, params))
  assert.strictEqual(ctx.pupitre, previous)
})

test('tenant resource authorization binds only the guard principal and restores host context', async ({
  assert,
  cleanup,
}) => {
  const app = new IgnitorFactory()
    .withCoreConfig()
    .withCoreProviders()
    .create(new URL('../tmp/app/', import.meta.url))
    .createApp('web')
  await app.init()
  await app.boot()
  cleanup(() => app.terminate())
  const { adapter, callbacks, manager, ctx } = fixture()
  class Policy {
    viewAny() {
      return true
    }
  }
  const definition = defineResource(Post).policy(Policy).toDefinition()
  manager.panels[0].resources.push({ slug: 'posts', definition } as never)
  const previous = { marker: 'host' }
  Object.assign(ctx, {
    pupitre: previous,
    bouncer: {
      with: () => ({
        allows: async () => ctx.pupitre.user?.id === 42 && ctx.pupitre.tenant?.id === 'own',
      }),
    },
  })
  manager.panels[0].tenancy = {
    mode: 'url',
    ownership: 'tenant_id',
    slugAttribute: 'slug',
    titleAttribute: 'name',
    menu: true,
    currentTenantAttribute: 'currentTenantId',
    adapter: {
      listForUser: async (bound) => {
        assert.equal(bound.pupitre.user?.id, 42)
        return [{ id: 'own', name: 'Owned' }]
      },
      resolve: async () => null,
      scope() {},
      fill: (data) => data,
    },
  }
  await adapter.initialize!(manager)
  const check = callbacks['pupitre/:panel/tenants/:tenant/resources/:resource']
  assert.isTrue(await check(ctx, { panel: 'admin', tenant: 'own', resource: 'posts' }))
  assert.isFalse(await check(ctx, { panel: 'admin', tenant: 'foreign', resource: 'posts' }))
  assert.strictEqual(ctx.pupitre, previous)
})
