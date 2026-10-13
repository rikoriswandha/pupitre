import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import type { TableDefinition } from '../definition/table.js'
import { parseTableParams, E_PUPITRE_INVALID_SORT } from '../query/table_query.js'
import { compileValidator } from '../compiler/vine_compiler.js'
import { buildCustomTableData } from './table_data.js'
import type { ActionDescriptor } from '../../catalog/wire.js'

export async function loadCustomTable(
  ctx: HttpContext,
  table: TableDefinition,
  prefix: string,
  rowActions: (row: Record<string, unknown>) => Promise<ActionDescriptor[]>,
  record?: unknown
) {
  if (!table.records) throw new Error('Custom table requires records()')
  const params = parseTableParams(ctx.request.qs(), prefix)
  const defaultSorts = table.defaultSorts ?? (table.defaultSort ? [table.defaultSort] : [])
  const requested =
    params.sort ??
    defaultSorts.map((item) => `${item.direction === 'desc' ? '-' : ''}${item.column}`).join(',')
  const encoded =
    Array.isArray(requested) && requested.every((item) => typeof item === 'string')
      ? requested.join(',')
      : requested
  if (typeof encoded !== 'string') throw new E_PUPITRE_INVALID_SORT(['encoding'])
  const names = encoded ? encoded.split(',') : []
  if (
    names.length > (table.multiSort ?? 1) ||
    new Set(names.map((item) => item.replace(/^-/, ''))).size !== names.length
  )
    throw new E_PUPITRE_INVALID_SORT(['sort limit or duplicate'])
  const sort = names.map((item) => {
    const column = item.replace(/^-/, '')
    if (
      !table.columns.some(
        (entry) => entry.kind !== 'fragment' && entry.name === column && entry.sortable
      )
    )
      throw new E_PUPITRE_INVALID_SORT([column])
    return { column, direction: item.startsWith('-') ? ('desc' as const) : ('asc' as const) }
  })
  const filters: Record<string, unknown> = {}
  const submitted = params.filters && typeof params.filters === 'object' ? params.filters : {}
  for (const filter of table.filters) {
    if (!Object.hasOwn(submitted, filter.name)) continue
    const value = Reflect.get(submitted, filter.name)
    if (value === '' || value === undefined) continue
    if (filter.kind === 'custom') {
      filters[filter.name] = await compileValidator([...(filter.form ?? [])]).validate(value, {
        ctx,
        timezone: ctx.pupitre.timezone,
      })
    } else {
      const schema =
        filter.kind === 'select'
          ? filter.multiple
            ? vine.array(vine.enum(Object.keys(filter.options ?? {})))
            : vine.enum(Object.keys(filter.options ?? {}))
          : filter.kind === 'ternary'
            ? vine.enum(['true', 'false', '1', '0'])
            : vine.object({
                from: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
                to: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
              })
      const validated = await vine.compile(vine.object({ value: schema })).validate({ value })
      filters[filter.name] =
        filter.kind === 'dateRange' && value && typeof value === 'object'
          ? Object.fromEntries(
              Object.keys(validated.value).map((key) => [key, Reflect.get(value, key)])
            )
          : validated.value
    }
  }
  const choices = table.paginated === false ? [] : table.paginated
  const requestedPerPage = params.perPage === 'all' ? 'all' : Number(params.perPage)
  const perPage =
    table.paginated === false || (requestedPerPage === 'all' && choices.includes('all'))
      ? ('all' as const)
      : typeof requestedPerPage === 'number' && choices.includes(requestedPerPage)
        ? requestedPerPage
        : typeof choices[0] === 'number'
          ? choices[0]
          : 25
  const requestedPage = Number(params.page)
  const page =
    perPage === 'all' ? 1 : Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const search =
    table.columns.some((column) => column.kind !== 'fragment' && column.searchable) &&
    typeof params.q === 'string'
      ? params.q
      : ''
  const result = await table.records({ ctx, search, filters, sort, page, perPage, record })
  const simple = result.total === undefined && perPage !== 'all'
  const hasNext = typeof perPage === 'number' && result.rows.length > perPage
  const rows = typeof perPage === 'number' ? result.rows.slice(0, perPage) : result.rows
  const size = typeof perPage === 'number' ? perPage : rows.length || 1
  const total = result.total ?? (page - 1) * size + rows.length + (hasNext ? 1 : 0)
  return buildCustomTableData(
    table,
    rows,
    {
      total,
      perPage: size,
      currentPage: page,
      lastPage: simple ? page + (hasNext ? 1 : 0) : Math.max(1, Math.ceil(total / size)),
      from: rows.length ? (page - 1) * size + 1 : 0,
      to: rows.length ? (page - 1) * size + rows.length : 0,
      ...(simple ? { simple: true, hasNext } : {}),
    },
    {
      ctx,
      locale: ctx.pupitre.locale,
      timezone: ctx.pupitre.timezone,
      normalized: { q: search, sort: encoded, filters, page, perPage },
      rowActions,
    }
  )
}
