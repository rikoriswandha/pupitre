import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { ResourceRuntime } from '../manager.js'
import { applyTenantScope } from '../tenancy/runtime.js'

/**
 * The only entry point for resource queries (ARCHITECTURE §6): applies the
 * resource `.scope()` and the panel tenancy scope. Controllers never call
 * `Model.query()` directly.
 */
export function scopedQuery(
  ctx: HttpContext,
  resource: ResourceRuntime
): ModelQueryBuilderContract<LucidModel> {
  const query = resource.model.query()
  if (typeof resource.definition.scope === 'function') resource.definition.scope(query, ctx)
  if (resource.definition.scope !== false) applyTenantScope(ctx, resource, query)
  return query
}

/** Resolves a resource of the current request's panel (URLs are request-bound). */
export function requestResource(ctx: HttpContext, slug: string): ResourceRuntime | undefined {
  return ctx.pupitre.panel.resources.find((resource) => resource.slug === slug)
}
