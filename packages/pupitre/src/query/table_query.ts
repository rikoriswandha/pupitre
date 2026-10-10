import { createError } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type {
  QueryCallback,
  TableColumnDefinition,
  TableDefinition,
  TableFilterDefinition,
} from '../definition/table.js'

type ListTabs = Record<string, { label?: string; where?: Record<string, unknown> | QueryCallback }>
type QueryOptions = { ctx?: HttpContext; tabs?: ListTabs }
type QueryResult = {
  query: ModelQueryBuilderContract<LucidModel>
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
  return filter.kind === 'custom' ? undefined : (filter.attribute ?? filter.name)
}

function applyLike(
  query: ModelQueryBuilderContract<LucidModel>,
  column: string,
  value: string,
  or = false
) {
  if (query.client.dialect.name === 'postgres') {
    if (or) query.orWhereILike(column, `%${value}%`)
    else query.whereILike(column, `%${value}%`)
  } else if (or) {
    query.orWhereRaw('lower(??) like ?', [column, `%${value.toLocaleLowerCase()}%`])
  } else {
    query.whereRaw('lower(??) like ?', [column, `%${value.toLocaleLowerCase()}%`])
  }
}

function applySearch(
  query: ModelQueryBuilderContract<LucidModel>,
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
          callback: (query: ModelQueryBuilderContract<LucidModel>) => void
        ) => unknown
        whereHas.call(builder, relation, (relationQuery) =>
          applyLike(relationQuery, attribute, value)
        )
      } else {
        applyLike(builder, column.name, value, index > 0)
      }
    })
  })
}

function applyRelationSort(
  query: ModelQueryBuilderContract<LucidModel>,
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

export function applyTableQuery(
  query: ModelQueryBuilderContract<LucidModel>,
  table: TableDefinition,
  params: Record<string, unknown>,
  options: QueryOptions = {}
): QueryResult {
  const normalized: Record<string, unknown> = {}
  if (table.query) table.query(query, options.ctx as HttpContext)

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

  if (table.columns.some((column) => column.kind !== 'fragment' && column.searchable)) {
    applySearch(query, table, params.q)
    if (typeof params.q === 'string' && params.q.length > 0) normalized.q = params.q
  }

  const filters =
    params.filters && typeof params.filters === 'object'
      ? (params.filters as Record<string, unknown>)
      : {}
  for (const filter of table.filters) {
    if (!Object.hasOwn(filters, filter.name)) continue
    const value = filters[filter.name]
    const attribute = filterAttribute(filter)
    if (filter.kind === 'custom') {
      if (!filter.query) continue
      filter.query(
        query,
        value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
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
      const zone = timezone(options.ctx)
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
    if (typeof tab.where === 'function') tab.where(query, options.ctx as HttpContext)
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
