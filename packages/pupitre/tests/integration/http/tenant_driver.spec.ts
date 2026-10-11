import { test } from '@japa/runner'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { TenancyDefinition } from '../../../src/definition/tenancy.js'
import { createTenantDriver } from '../../../src/drivers/tenant.js'
import Post from '../../fixtures/models/post.js'

let hasTenantPeer = false
try {
  await import('@rikology/adonisjs-tenant')
  hasTenantPeer = true
} catch {
  hasTenantPeer = false
}

test('runs downstream work inside adonisjs-tenant context', async ({ assert }) => {
  const definition: TenancyDefinition = {
    mode: 'url',
    model: async () => ({ default: Post }),
    ownership: 'tenant_id',
    slugAttribute: 'slug',
    titleAttribute: 'name',
    menu: false,
    currentTenantAttribute: 'currentTenantId',
    tenantsForUser: async () => [],
  }
  const adapter = await createTenantDriver(definition)
  let current: unknown
  await adapter.run?.({ id: 42, name: 'Acme', slug: 'acme' }, async () => {
    const tenant = await import('@rikology/adonisjs-tenant')
    current = tenant.getTenantContext()
  })
  assert.deepEqual(current, { id: 42, name: 'Acme', slug: 'acme' })
}).skip(!hasTenantPeer, 'optional peer @rikology/adonisjs-tenant is not installed')
test('resolves URL PathResolver and implicit tenants and enforces membership', async ({
  assert,
}) => {
  const rows = [
    { id: 1, name: 'Acme', slug: 'acme' },
    { id: 2, name: 'Globex', slug: 'globex' },
  ]
  const model = {
    query() {
      let attribute = ''
      let value: unknown
      return {
        where(column: string, expected: unknown) {
          attribute = column
          value = expected
          return this
        },
        async first() {
          return rows.find((row) => row[attribute as 'slug'] === value) ?? null
        },
      }
    },
    async find(id: number) {
      return rows.find((row) => row.id === id) ?? null
    },
  } as unknown as LucidModel
  const user = {
    currentTenantId: 1,
    merge(values: Record<string, unknown>) {
      Object.assign(this, values)
      return this
    },
    async save() {},
  }
  const definition: TenancyDefinition = {
    mode: 'url',
    model: async () => ({ default: model }),
    ownership: 'tenant_id',
    slugAttribute: 'slug',
    titleAttribute: 'name',
    menu: false,
    currentTenantAttribute: 'currentTenantId',
    tenantsForUser: async () => rows as never,
  }
  const adapter = await createTenantDriver(definition)
  const urlContext = {
    params: { tenant: 'acme' },
    request: { url: () => '/admin/acme/posts' },
    pupitre: { authUser: user },
  }
  assert.deepEqual(await adapter.resolve?.(urlContext as never), {
    id: 1,
    name: 'Acme',
    slug: 'acme',
    record: rows[0],
  })
  urlContext.params.tenant = 'missing'
  assert.isNull(await adapter.resolve?.(urlContext as never))

  const implicit = await createTenantDriver({ ...definition, mode: 'implicit' })
  const implicitResolved = await implicit.resolve?.(urlContext as never)
  assert.equal(implicitResolved?.id, 1)
  user.currentTenantId = 99
  assert.isNull(await implicit.resolve?.(urlContext as never))
  assert.deepEqual(
    implicit.fill(
      { title: 'Test' },
      { id: 2 } as never,
      { ownership: 'tenant_id', model, ctx: urlContext } as never
    ),
    { title: 'Test', tenant_id: 2 }
  )
  let scoped: unknown[] = []
  const query = { where: (...args: unknown[]) => (scoped = args) }
  implicit.scope?.(
    query as never,
    { id: 2 } as never,
    {
      ownership: 'tenant_id',
      model,
      ctx: urlContext,
    } as never
  )
  assert.deepEqual(scoped, ['tenant_id', 2])
  user.currentTenantId = 1
  assert.isTrue(await implicit.switch?.(urlContext as never, 2))
  assert.equal(user.currentTenantId, 2)
}).skip(!hasTenantPeer, 'optional peer @rikology/adonisjs-tenant is not installed')
