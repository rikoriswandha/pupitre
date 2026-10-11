import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { PanelRuntime } from '../../../src/manager.js'
import { createColumnTenancyAdapter } from '../../../src/tenancy/column_driver.js'
import { definePanel } from '../../../index.js'
import Post from '../../fixtures/models/post.js'

const records = [
  { id: 1, name: 'Acme', slug: 'acme' },
  { id: 2, name: 'Globex', slug: 'globex' },
] as unknown as LucidRow[]

function panel(mode: 'url' | 'implicit', user: Record<string, unknown>) {
  const definition = definePanel('admin')
    .path('/admin')
    .tenancy({
      mode,
      model: async () => ({ default: Post }),
      tenantsForUser: async () => records,
      currentTenantAttribute: 'currentTenantId',
    })
    .toDefinition()
  return {
    ...definition,
    resources: [],
    pages: [],
    authUser: user as unknown as LucidRow,
  } as unknown as PanelRuntime
}

test.group('default column tenancy driver', () => {
  test('resolves URL tenants only from user memberships and fills model attributes', async ({
    assert,
  }) => {
    const adapter = createColumnTenancyAdapter(panel('url', {}))
    const ctx = { params: { tenant: 'acme' }, pupitre: { authUser: {} } } as unknown as HttpContext
    const tenant = await adapter.resolve(ctx)
    assert.equal(tenant?.id, 1)
    assert.equal(tenant?.slug, 'acme')
    assert.isNull(
      await adapter.resolve({
        params: { tenant: 'outside-membership' },
        pupitre: { authUser: {} },
      } as unknown as HttpContext)
    )
    assert.deepEqual(
      adapter.fill({ title: 'Hello' }, tenant!, {
        ownership: 'tenant_id',
        model: Post,
        ctx,
      }),
      { title: 'Hello', tenantId: 1 }
    )
  })

  test('reads the implicit tenant from the user current-tenant property', async ({ assert }) => {
    const adapter = createColumnTenancyAdapter(panel('implicit', { currentTenantId: 2 }))
    const tenant = await adapter.resolve({
      pupitre: { authUser: { currentTenantId: 2 } },
    } as unknown as HttpContext)
    assert.equal(tenant?.id, 2)
    assert.equal(tenant?.slug, 'globex')
  })
})
