import { DateTime } from 'luxon'
import { compileValidator } from '../../compiler/vine_compiler.js'
import { createError } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { TableDefinition } from '../../definition/table.js'
import { applyTableQuery, E_PUPITRE_INVALID_SORT } from '../../query/table_query.js'
import { E_PUPITRE_INVALID_QUERY } from '../../query/query_builder.js'

export const E_PUPITRE_INVALID_VIEW = createError(
  'E_PUPITRE_INVALID_VIEW',
  'Invalid saved table view',
  422
)
export const tableViewQueryKeys = [
  'q',
  'sort',
  'filters',
  'groupBy',
  'perPage',
  'tab',
  'columns',
] as const
export async function normalizeViewQuery(
  model: LucidModel,
  table: TableDefinition,
  value: Record<string, unknown>,
  ctx: HttpContext,
  tabs?: Record<
    string,
    { label?: string; where?: Record<string, unknown> | NonNullable<TableDefinition['query']> }
  >
) {
  const invalid = () => {
    throw new E_PUPITRE_INVALID_VIEW()
  }
  if (
    Object.keys(value).some(
      (key) => !tableViewQueryKeys.includes(key as (typeof tableViewQueryKeys)[number])
    )
  )
    invalid()
  if (JSON.stringify(value).length > 8192) invalid()
  if (
    value.q !== undefined &&
    (typeof value.q !== 'string' ||
      !table.columns.some((column) => column.kind !== 'fragment' && column.searchable))
  )
    invalid()
  if (value.groupBy !== undefined && !table.groups?.some((group) => group.key === value.groupBy))
    invalid()
  if (value.tab !== undefined && (typeof value.tab !== 'string' || !tabs?.[value.tab])) invalid()
  if (
    value.perPage !== undefined &&
    (table.paginated === false
      ? value.perPage !== 'all'
      : !table.paginated.some((choice) => String(choice) === String(value.perPage)))
  )
    invalid()
  if (value.filters !== undefined) {
    if (!value.filters || typeof value.filters !== 'object' || Array.isArray(value.filters))
      invalid()
    for (const [name, item] of Object.entries(value.filters as Record<string, unknown>)) {
      const filter = table.filters.find((candidate) => candidate.name === name)
      if (!filter) invalid()
      if (filter?.kind === 'custom') {
        if (!item || typeof item !== 'object' || Array.isArray(item)) invalid()
        try {
          await compileValidator([...(filter.form ?? [])]).validate(item, {
            ctx,
            timezone: ctx.pupitre.timezone,
          })
        } catch (error) {
          if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'E_VALIDATION_ERROR'
          )
            invalid()
          throw error
        }
      }
      if (filter?.kind === 'select') {
        const values = filter.multiple && Array.isArray(item) ? item : [item]
        if (
          (!filter.multiple && Array.isArray(item)) ||
          values.some(
            (entry) =>
              typeof entry !== 'string' || (filter.options && !Object.hasOwn(filter.options, entry))
          )
        )
          invalid()
      }
      if (filter?.kind === 'ternary' && ![true, false, 'true', 'false', ''].includes(item as never))
        invalid()
      if (filter?.kind === 'trashed' && !['with', 'without', 'only'].includes(String(item)))
        invalid()
      if (filter?.kind === 'dateRange') {
        if (!item || typeof item !== 'object' || Array.isArray(item)) invalid()
        for (const [key, date] of Object.entries(item as Record<string, unknown>)) {
          if (
            !['from', 'to'].includes(key) ||
            typeof date !== 'string' ||
            (date !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !DateTime.fromISO(date).isValid))
          )
            invalid()
        }
      }
    }
  }
  if (value.columns !== undefined) {
    if (!value.columns || typeof value.columns !== 'object' || Array.isArray(value.columns))
      invalid()
    for (const [name, search] of Object.entries(value.columns as Record<string, unknown>)) {
      const column = table.columns.find(
        (candidate) => candidate.kind !== 'fragment' && candidate.name === name
      )
      if (
        !column ||
        column.kind === 'fragment' ||
        !column.individuallySearchable ||
        !search ||
        typeof search !== 'object' ||
        Array.isArray(search) ||
        Object.keys(search).some((key) => key !== 'search') ||
        typeof (search as Record<string, unknown>).search !== 'string'
      )
        invalid()
    }
  }
  try {
    const normalized = applyTableQuery(model.query(), table, structuredClone(value), {
      ctx,
      tabs,
    }).normalized
    delete normalized.page
    return normalized
  } catch (error) {
    if (error instanceof E_PUPITRE_INVALID_SORT || error instanceof E_PUPITRE_INVALID_QUERY)
      throw new E_PUPITRE_INVALID_VIEW()
    throw error
  }
}
export function normalizeViewColumns(table: TableDefinition, value: Record<string, boolean>) {
  for (const [name, visible] of Object.entries(value)) {
    const column = table.columns.find(
      (candidate) => candidate.kind !== 'fragment' && candidate.name === name
    )
    if (
      typeof visible !== 'boolean' ||
      !column ||
      column.kind === 'fragment' ||
      (!column.toggleable && !visible)
    )
      throw new E_PUPITRE_INVALID_VIEW()
  }
  return value
}
