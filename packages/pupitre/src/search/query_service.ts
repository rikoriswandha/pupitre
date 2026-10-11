import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { ResourceRuntime } from '../manager.js'
import { authorizeResource } from '../authz/bouncer.js'
import { applySearchColumns } from '../query/like.js'
import { scopedQuery } from '../query/scoped_query.js'
type SearchResult = { title: string; details?: string[]; url: string }
type SearchGroup = { resource: string; label: string; results: SearchResult[] }

function applySearch(
  query: ModelQueryBuilderContract<LucidModel, LucidRow>,
  resource: ResourceRuntime,
  value: string
) {
  const columns = resource.definition.globallySearchable ?? []
  query.where((builder) => {
    columns.forEach((name, index) => {
      const [relation, attribute] = name.includes('.') ? name.split('.', 2) : []
      if (relation && attribute) {
        const whereHas = (index === 0 ? builder.whereHas : builder.orWhereHas) as unknown as (
          relation: string,
          callback: (query: ModelQueryBuilderContract<LucidModel>) => void
        ) => unknown
        const relatedModel = query.model.$getRelation(relation).relatedModel()
        whereHas.call(builder, relation, (relatedQuery) =>
          applySearchColumns(relatedQuery, [attribute], value, relatedModel)
        )
      } else {
        applySearchColumns(builder, [name], value, query.model, index > 0)
      }
    })
  })
}

async function resultFor(
  ctx: HttpContext,
  resource: ResourceRuntime,
  record: LucidRow
): Promise<SearchResult | undefined> {
  const id = record.$getAttribute(
    (resource.model as LucidModel & { primaryKey?: string }).primaryKey ?? 'id'
  )
  const canView =
    resource.definition.pages.view && (await authorizeResource(ctx, resource, 'view', record))
  const canEdit =
    resource.definition.pages.edit && (await authorizeResource(ctx, resource, 'update', record))
  const url = canView
    ? resource.urls.view(String(id))
    : canEdit
      ? resource.urls.edit(String(id))
      : undefined
  if (!url) return undefined

  const titleAttribute = resource.definition.recordTitle ?? 'id'
  const title = record.$getAttribute(titleAttribute)
  const details = resource.definition.globalSearchDetails?.(record)
  return {
    title: title === null || title === undefined ? resource.label : String(title),
    ...(details?.length ? { details } : {}),
    url,
  }
}

async function searchResource(
  ctx: HttpContext,
  resource: ResourceRuntime,
  term: string
): Promise<SearchGroup | undefined> {
  if (!resource.definition.globallySearchable?.length) return undefined
  if (!(await authorizeResource(ctx, resource, 'viewAny'))) return undefined

  const query = scopedQuery(ctx, resource)
  if (resource.definition.globalSearchDetails) {
    const relations = new Set(
      (resource.definition.globallySearchable ?? []).flatMap((column) =>
        column.includes('.') ? [column.split('.', 1)[0]!] : []
      )
    )
    for (const relation of relations) query.preload(relation as never)
  }
  applySearch(query, resource, term)
  const primaryKey = (resource.model as LucidModel & { primaryKey?: string }).primaryKey ?? 'id'
  query.orderBy(primaryKey, 'asc')
  const results: SearchResult[] = []
  const pageSize = 25
  const maxBatches = 4
  for (let batch = 0; batch < maxBatches && results.length < 5; batch++) {
    const records = await query.offset(batch * pageSize).limit(pageSize)
    for (const record of records) {
      const result = await resultFor(ctx, resource, record)
      if (result) results.push(result)
      if (results.length === 5) break
    }
    if (records.length < pageSize) break
  }
  return results.length
    ? { resource: resource.slug, label: resource.pluralLabel, results }
    : undefined
}

export async function searchResources(
  ctx: HttpContext,
  resources: ResourceRuntime[],
  query: unknown
) {
  const term = typeof query === 'string' ? query.trim() : ''
  if (term.length < 2) return { groups: [] as SearchGroup[] }
  const groups = await Promise.all(resources.map((resource) => searchResource(ctx, resource, term)))
  return { groups: groups.filter((group): group is SearchGroup => group !== undefined) }
}
