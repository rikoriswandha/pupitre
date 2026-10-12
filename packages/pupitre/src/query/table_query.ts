import { createError } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type {
  QueryCallback,
  TableColumnDefinition,
  TableDefinition,
  TableFilterDefinition,
} from '../definition/table.js'
import { applySearchColumns } from './like.js'
import { applyGroupedScope } from './grouped_scope.js'

type ListTabs = Record<string, { label?: string; where?: Record<string, unknown> | QueryCallback }>
type QueryOptions = { ctx?: HttpContext; tabs?: ListTabs; prefix?: string }
type QueryResult = {
  query: ModelQueryBuilderContract<LucidModel, LucidRow>
  normalized: Record<string, unknown>
  perPage: number | 'all'
  page: number
}

export const E_PUPITRE_INVALID_SORT = createError(
  'E_PUPITRE_INVALID_SORT',
  'Column "%s" is not sortable',
  400
)

function getColumn(table: TableDefinition, name: string) {
  return table.columns.find((column) => column.kind !== 'fragment' && column.name === name)
}

function filterAttribute(filter: TableFilterDefinition) {
  return filter.kind === 'custom' || filter.kind === 'trashed'
    ? undefined
    : (filter.attribute ?? filter.name)
}

function applySearch(
  query: ModelQueryBuilderContract<LucidModel, LucidRow>,
  table: TableDefinition,
  value: unknown
) {
  if (typeof value !== 'string' || value.trim() === '') return
  const searchable: Exclude<TableColumnDefinition, { kind: 'fragment' }>[] = []
  for (const column of table.columns) {
    if (column.kind !== 'fragment' && column.searchable) searchable.push(column)
  }
  if (!searchable.length) return
  query.where((builder) => {
    searchable.forEach((column, index) => {
      const [relation, attribute] = column.name.includes('.') ? column.name.split('.', 2) : []
      if (relation && attribute) {
        const whereHas = (index === 0 ? builder.whereHas : builder.orWhereHas) as unknown as (
          relation: string,
          callback: (query: ModelQueryBuilderContract<LucidModel, LucidRow>) => void
        ) => unknown
        const relatedModel = query.model.$getRelation(relation).relatedModel()
        whereHas.call(builder, relation, (relationQuery) =>
          applySearchColumns(relationQuery, [attribute], value, relatedModel)
        )
      } else {
        applySearchColumns(builder, [column.name], value, query.model, index > 0)
      }
    })
  })
}

function applyRelationSort(
  query: ModelQueryBuilderContract<LucidModel, LucidRow>,
  name: string,
  direction: 'asc' | 'desc'
) {
  const [relationName, attribute] = name.split('.', 2)
  const relation = query.model.$getRelation(relationName)
  relation.boot()
  query.orderBy(relation.subQuery(query.client).select(attribute) as never, direction)
}

function timezone(ctx?: HttpContext) {
  if (!ctx) return 'UTC'
  const pupitre = 'pupitre' in ctx ? ctx.pupitre : undefined
  if (
    pupitre &&
    typeof pupitre === 'object' &&
    'timezone' in pupitre &&
    typeof pupitre.timezone === 'string'
  ) {
    return pupitre.timezone
  }
  return 'UTC'
}

export function parseTableParams(
  params: Record<string, unknown>,
  prefix?: string
): Record<string, unknown> {
  if (!prefix) return params
  const nested = params[prefix]
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>
  }
  const marker = `${prefix}[`
  const parsed: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith(marker) || !key.endsWith(']')) continue
    const path = key.slice(marker.length, -1).split('][')
    let target = parsed
    for (const segment of path.slice(0, -1)) {
      const child = target[segment]
      if (!child || typeof child !== 'object' || Array.isArray(child)) target[segment] = {}
      target = target[segment] as Record<string, unknown>
    }
    target[path[path.length - 1]!] = value
  }
  return parsed
}

export function applyTableQuery(
  query: ModelQueryBuilderContract<LucidModel, LucidRow>,
  table: TableDefinition,
  params: Record<string, unknown>,
  options: QueryOptions = {}
): QueryResult {
  params = parseTableParams(params, options.prefix)
  const normalized: Record<string, unknown> = {}
  if (table.query)
    applyGroupedScope(query, (builder) => table.query!(builder, options.ctx as HttpContext))
  const sort = typeof params.sort === 'string' && params.sort.length ? params.sort : undefined
  const requestedSort =
    sort ??
    (table.defaultSort
      ? `${table.defaultSort.direction === 'desc' ? '-' : ''}${table.defaultSort.column}`
      : undefined)
  if (requestedSort) {
    const direction = requestedSort.startsWith('-') ? 'desc' : 'asc'
    const name = requestedSort.replace(/^-/, '')
    const column = getColumn(table, name)
    if (!column || column.kind === 'fragment' || !column.sortable) {
      throw new E_PUPITRE_INVALID_SORT([name])
    }
    if (name.includes('.')) applyRelationSort(query, name, direction)
    else query.orderBy(name, direction)
    normalized.sort = requestedSort
  }
  if (!requestedSort && table.reorderable) query.orderBy(table.reorderable, 'asc')

  if (table.columns.some((column) => column.kind !== 'fragment' && column.searchable)) {
    applySearch(query, table, params.q)
    if (typeof params.q === 'string' && params.q.length > 0) normalized.q = params.q
  }
  const individualSearches =
    params.columns && typeof params.columns === 'object'
      ? (params.columns as Record<string, unknown>)
      : {}
  for (const column of table.columns) {
    if (
      column.kind === 'fragment' ||
      !column.individuallySearchable ||
      !Object.hasOwn(individualSearches, column.name)
    )
      continue
    const entry = individualSearches[column.name]
    const value =
      entry && typeof entry === 'object' ? (entry as Record<string, unknown>).search : undefined
    if (typeof value !== 'string' || !value.trim()) continue
    const [relation, attribute] = column.name.split('.', 2)
    if (relation && attribute) {
      const whereHas = query.whereHas as unknown as (
        relation: string,
        callback: (query: ModelQueryBuilderContract<LucidModel, LucidRow>) => void
      ) => unknown
      whereHas.call(query, relation, (relatedQuery) => {
        const relatedModel = query.model.$getRelation(relation).relatedModel()
        applySearchColumns(relatedQuery, [attribute], value, relatedModel)
      })
    } else applySearchColumns(query, [column.name], value, query.model)
    normalized.columns = {
      ...(normalized.columns as Record<string, unknown> | undefined),
      [column.name]: { search: value },
    }
  }
  const requestedGroup = typeof params.groupBy === 'string' ? params.groupBy : undefined
  if (requestedGroup && table.groups?.some((group) => group.key === requestedGroup)) {
    normalized.groupBy = requestedGroup
  } else if (
    table.defaultGroup &&
    table.groups?.some((group) => group.key === table.defaultGroup)
  ) {
    normalized.groupBy = table.defaultGroup
  }

  const filters =
    params.filters && typeof params.filters === 'object'
      ? (params.filters as Record<string, unknown>)
      : {}
  for (const filter of table.filters) {
    if (!Object.hasOwn(filters, filter.name)) continue
    const value = filters[filter.name]
    if (filter.kind === 'trashed') {
      if (value === 'only' || value === 'with' || value === 'without')
        normalized.filters = {
          ...(normalized.filters as Record<string, unknown> | undefined),
          [filter.name]: value,
        }
      continue
    }
    const attribute = filterAttribute(filter)
    if (filter.kind === 'custom') {
      if (!filter.query) continue
      applyGroupedScope(query, (builder) =>
        filter.query!(
          builder,
          value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
        )
      )
    } else if (filter.kind === 'select') {
      if (filter.multiple && Array.isArray(value)) query.whereIn(attribute!, value as never[])
      else if (value !== null && value !== undefined && value !== '')
        query.where(attribute!, value as never)
      else continue
    } else if (filter.kind === 'ternary') {
      if (value === true || value === 'true') query.where(attribute!, true)
      else if (value === false || value === 'false') query.where(attribute!, false)
      else continue
    } else {
      if (!value || typeof value !== 'object') continue
      const range = value as { from?: unknown; to?: unknown }
      const zone =
        'timezone' in filter && typeof filter.timezone === 'string'
          ? filter.timezone
          : timezone(options.ctx)
      const fromDate =
        typeof range.from === 'string'
          ? DateTime.fromISO(range.from, { zone }).startOf('day')
          : null
      const toDate =
        typeof range.to === 'string' ? DateTime.fromISO(range.to, { zone }).endOf('day') : null
      const from = fromDate?.isValid ? fromDate.toUTC().toSQL() : null
      const to = toDate?.isValid ? toDate.toUTC().toSQL() : null
      if (from && to) query.whereBetween(attribute!, [from, to])
      else if (from) query.where(attribute!, '>=', from)
      else if (to) query.where(attribute!, '<=', to)
      else continue
    }
    normalized.filters = {
      ...(normalized.filters as Record<string, unknown> | undefined),
      [filter.name]: value,
    }
  }

  if (typeof params.tab === 'string' && options.tabs?.[params.tab]) {
    const tab = options.tabs[params.tab]
    if (typeof tab.where === 'function')
      applyGroupedScope(query, (builder) =>
        (tab.where as QueryCallback)(builder, options.ctx as HttpContext)
      )
    else if (tab.where) query.where(tab.where)
    normalized.tab = params.tab
  }

  const choices = table.paginated === false ? [] : table.paginated
  const defaultPerPage = typeof choices[0] === 'number' ? choices[0] : 25
  const requestedPerPage = params.perPage === 'all' ? 'all' : Number(params.perPage)
  const perPage =
    table.paginated === false
      ? 'all'
      : requestedPerPage === 'all' && choices.includes('all')
        ? 'all'
        : typeof requestedPerPage === 'number' &&
            Number.isInteger(requestedPerPage) &&
            choices.includes(requestedPerPage)
          ? requestedPerPage
          : defaultPerPage
  const requestedPage = Number(params.page)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  normalized.perPage = perPage
  normalized.page = page

  return { query, normalized, perPage, page }
}
