import type { HttpContext } from '@adonisjs/core/http'
import type { PupitrePageProps } from '../../catalog/wire.js'
import { resolveTenancyAdapter } from './runtime.js'

type Shared = PupitrePageProps['pupitre']

/** Builds tenant and switcher props for the current panel request. */
export async function tenancyProps(
  ctx: HttpContext
): Promise<{ tenant: Shared['tenant']; tenants?: Shared['tenants'] }> {
  const panel = ctx.pupitre.panel
  const tenancy = panel.tenancy
  if (!tenancy) return { tenant: null }
  const tenant = ctx.pupitre.tenant
  if (!tenancy.menu)
    return {
      tenant: tenant
        ? { id: tenant.id, name: tenant.name, ...(tenant.slug ? { slug: tenant.slug } : {}) }
        : null,
    }
  const adapter = await resolveTenancyAdapter(ctx)
  const memberships = adapter ? await adapter.listForUser(ctx) : []
  const urlMode = tenancy.mode === 'url'
  return {
    tenant: tenant
      ? { id: tenant.id, name: tenant.name, ...(tenant.slug ? { slug: tenant.slug } : {}) }
      : null,
    tenants: memberships.map((item) => ({
      id: item.id,
      name: item.name,
      url: urlMode
        ? `${ctx.pupitre.basePath}/${item.slug ?? encodeURIComponent(String(item.id))}`
        : `${ctx.pupitre.basePath}/_pupitre/tenant`,
      method: urlMode ? ('get' as const) : ('post' as const),
      current: tenant ? String(tenant.id) === String(item.id) : false,
    })),
  }
}
