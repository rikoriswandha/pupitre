import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { ResourceRuntime } from '../manager.js'
import { createColumnTenancyAdapter } from './column_driver.js'
import type { TenancyAdapter } from '../definition/tenancy.js'

export async function resolveTenancyAdapter(ctx: HttpContext): Promise<TenancyAdapter | null> {
  const panel = ctx.pupitre.panel
  const tenancy = panel.tenancy
  if (!tenancy) return null
  if (ctx.pupitre.tenancyAdapter) return ctx.pupitre.tenancyAdapter
  let adapter: TenancyAdapter
  if (tenancy.adapter) {
    adapter = typeof tenancy.adapter === 'function' ? await tenancy.adapter() : tenancy.adapter
  } else {
    adapter = createColumnTenancyAdapter(panel)
  }
  ctx.pupitre.tenancyAdapter = adapter
  return adapter
}

/** Restricts resource queries unless `.scope(false)` opted the resource out. */
export function applyTenantScope(
  ctx: HttpContext,
  resource: ResourceRuntime,
  query: ModelQueryBuilderContract<LucidModel>
): void {
  const tenancy = ctx.pupitre.panel.tenancy
  const tenant = ctx.pupitre.tenant
  const adapter = ctx.pupitre.tenancyAdapter
  if (!tenancy || !tenant || !adapter || resource.definition.scope === false) return
  adapter.scope(query, tenant, {
    ownership: tenancy.ownership,
    model: resource.model,
    ctx,
  })
}

/** Applies ownership after user hooks so create hooks cannot move data. */
export function fillTenantOwnership(
  ctx: HttpContext,
  resource: ResourceRuntime,
  data: Record<string, unknown>
): Record<string, unknown> {
  const tenancy = ctx.pupitre.panel.tenancy
  const tenant = ctx.pupitre.tenant
  const adapter = ctx.pupitre.tenancyAdapter
  if (!tenancy || !tenant || !adapter || resource.definition.scope === false) return data
  return adapter.fill(data, tenant, {
    ownership: tenancy.ownership,
    model: resource.model,
    ctx,
  })
}
