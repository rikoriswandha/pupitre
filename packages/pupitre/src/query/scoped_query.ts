import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { ResourceRuntime } from '../manager.js'
import { applyTenantScope } from '../tenancy/runtime.js'
import { applyGroupedScope } from './grouped_scope.js'

/**
 * The only entry point for resource queries (ARCHITECTURE §6): applies the
 * resource `.scope()` and the panel tenancy scope. Controllers never call
 * `Model.query()` directly.
 */
export function scopedQuery(
  ctx: HttpContext,
  resource: ResourceRuntime,
  options: { trashed?: 'with' | 'only' } = {}
): ModelQueryBuilderContract<LucidModel> {
  const query = resource.model.query()
  applyResourceScope(ctx, resource, query, options)
  return query
}

export function applyResourceScope(
  ctx: HttpContext,
  resource: ResourceRuntime,
  query: ModelQueryBuilderContract<LucidModel>,
  options: { trashed?: 'with' | 'only' } = {}
): void {
  const scope = resource.definition.scope
  if (typeof scope === 'function') applyGroupedScope(query, (builder) => scope(builder, ctx))
  if (resource.parent) {
    const relation = resource.model.$getRelation(resource.parent.relation)
    relation.boot()
    if (relation.type !== 'belongsTo') throw new Error('Nested parent relation must be belongsTo')
    const parentId = ctx.params[resource.parent.param]
    if (parentId === undefined) query.whereRaw('1 = 0')
    else query.where(relation.foreignKey, parentId)
  }
  if (resource.definition.scope !== false) applyTenantScope(ctx, resource, query)
  if (resource.definition.softDeletes) {
    if (options.trashed === 'only') query.whereNotNull(resource.definition.softDeletes)
    else if (options.trashed !== 'with') query.whereNull(resource.definition.softDeletes)
  }
}

export function requestResource(ctx: HttpContext, slug: string): ResourceRuntime | undefined {
  const resource = ctx.pupitre.panel.resources.find((item) => item.slug === slug)
  if (!resource?.parent) return resource
  const parentId = ctx.params[resource.parent.param]
  if (parentId === undefined) return resource
  const bind = (url: string) =>
    url.replace(`:${resource.parent!.param}`, encodeURIComponent(String(parentId)))
  return {
    ...resource,
    urls: {
      ...resource.urls,
      list: bind(resource.urls.list),
      create: bind(resource.urls.create),
      edit: (id) => bind(resource.urls.edit(id)),
      update: (id) => bind(resource.urls.update(id)),
      view: (id) => bind(resource.urls.view(id)),
      destroy: (id) => bind(resource.urls.destroy(id)),
      actions: (name, id) => bind(resource.urls.actions(name, id)),
    },
  }
}
