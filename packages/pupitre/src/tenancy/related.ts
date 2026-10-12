import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { applyResourceScope } from '../query/scoped_query.js'
import { fillTenantOwnership, resolveTenancyAdapter } from './runtime.js'

function hasOwnership(model: LucidModel, ownership: string) {
  model.boot()
  return model.$hasColumn(model.$keys.columnsToAttributes.get(ownership) ?? ownership)
}

/** Also scopes unregistered related models, but leaves models without ownership global. */
export async function applyRelatedScope(
  ctx: HttpContext,
  model: LucidModel,
  query: ModelQueryBuilderContract<LucidModel>,
  resource = ctx.pupitre.panel.resources.find((item) => item.model === model),
  options: { trashed?: 'with' | 'only' } = {}
) {
  await resolveTenancyAdapter(ctx)
  if (resource) {
    applyResourceScope(ctx, resource, query, options)
    return resource
  }
  const tenancy = ctx.pupitre.panel.tenancy
  const tenant = ctx.pupitre.tenant
  const adapter = ctx.pupitre.tenancyAdapter
  if (tenancy && tenant && adapter && hasOwnership(model, tenancy.ownership)) {
    adapter.scope(query, tenant, { ownership: tenancy.ownership, model, ctx })
  }
  return undefined
}

// Return an object: returning the thenable Lucid builder from async would execute it.
export async function relatedScopedQuery(ctx: HttpContext, model: LucidModel) {
  const query = model.query()
  await applyRelatedScope(ctx, model, query)
  return { query }
}

export async function fillRelatedOwnership(
  ctx: HttpContext,
  model: LucidModel,
  data: Record<string, unknown>,
  resource = ctx.pupitre.panel.resources.find((item) => item.model === model)
) {
  const adapter = await resolveTenancyAdapter(ctx)
  if (resource) return fillTenantOwnership(ctx, resource, data)
  const tenancy = ctx.pupitre.panel.tenancy
  const tenant = ctx.pupitre.tenant
  if (!tenancy || !tenant || !adapter || !hasOwnership(model, tenancy.ownership)) return data
  return adapter.fill(data, tenant, { ownership: tenancy.ownership, model, ctx })
}
