import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { ActionDescriptor, TableData, TableMeta, TableRow } from '../../catalog/wire.js'
import type { TableColumnDefinition, TableDefinition } from '../definition/table.js'
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatSince,
  truncate,
} from '../format/index.js'

export type TableDataOptions = {
  locale: string
  timezone: string
  rowActions(record: LucidRow): Promise<ActionDescriptor[]>
  rowUrl(record: LucidRow): string | undefined
  normalized: Record<string, unknown>
  resolveFileUrl?: (key: string) => Promise<string | null>
}

function valueAt(serialized: Record<string, unknown>, path: string): unknown {
  let value: unknown = serialized
  for (const segment of path.split('.')) {
    if (!value || typeof value !== 'object' || !(segment in value)) return undefined
    value = (value as Record<string, unknown>)[segment]
  }
  return value
}

function stringValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

async function formatCell(
  column: TableColumnDefinition,
  record: LucidRow,
  serialized: Record<string, unknown>,
  options: TableDataOptions
): Promise<unknown> {
  const value = column.kind === 'fragment' ? undefined : valueAt(serialized, column.name)
  if (column.kind === 'badge') {
    return { value, color: column.colors?.[stringValue(value)] }
  }
  if (column.kind === 'icon') {
    return {
      value,
      icon: column.icons?.[stringValue(value)],
      color: column.colors?.[stringValue(value)],
    }
  }
  if (column.kind === 'image') {
    if (typeof value !== 'string' || !value) return value
    return options.resolveFileUrl ? await options.resolveFileUrl(value) : value
  }
  if (column.kind !== 'text') return value
  const context = { locale: options.locale, timezone: options.timezone }
  if (column.money)
    return formatMoney(value as string | number | null, context, { currency: column.money })
  if (column.numeric) return formatNumber(value as string | number | null, context)
  if (column.dateTime) return formatDateTime(value as string | Date | null, context)
  if (column.date) return formatDate(value as string | Date | null, context)
  if (column.since) return formatSince(value as string | Date | null, context)
  if (column.description || column.url || column.limit !== undefined) {
    return {
      value: column.limit !== undefined ? truncate(value, column.limit) : value,
      ...(column.description ? { description: await column.description({ record }) } : {}),
      ...(column.url ? { url: await column.url({ record }) } : {}),
    }
  }
  return value
}

function metaFrom(input: unknown, count: number): TableMeta {
  if (input && typeof input === 'object' && 'total' in input) {
    const meta = input as Record<string, unknown>
    const perPage = Number(meta.perPage ?? meta.per_page ?? count) || 1
    const currentPage = Number(meta.currentPage ?? meta.current_page ?? 1) || 1
    const total = Number(meta.total) || 0
    return {
      total,
      perPage,
      currentPage,
      lastPage:
        Number(meta.lastPage ?? meta.last_page ?? Math.max(1, Math.ceil(total / perPage))) || 1,
      from: Number(meta.from ?? (count ? (currentPage - 1) * perPage + 1 : 0)) || 0,
      to: Number(meta.to ?? (count ? (currentPage - 1) * perPage + count : 0)) || 0,
    }
  }
  return {
    total: count,
    perPage: Math.max(count, 1),
    currentPage: 1,
    lastPage: 1,
    from: count ? 1 : 0,
    to: count,
  }
}

export async function buildTableData(
  table: TableDefinition,
  rows: LucidRow[],
  meta: unknown,
  options: TableDataOptions
): Promise<TableData> {
  const tableRows: TableRow[] = await Promise.all(
    rows.map(async (record) => {
      const serialized = record.serialize() as Record<string, unknown>
      const cells: Record<string, unknown> = {}
      for (const column of table.columns) {
        const name = column.kind === 'fragment' ? column.component : column.name
        cells[name] = await formatCell(column, record, serialized, options)
      }
      const key = record.$primaryKeyValue
      if (typeof key !== 'string' && typeof key !== 'number') {
        throw new Error('Table rows require a Lucid primary key')
      }
      const url = table.recordUrl === false ? undefined : options.rowUrl(record)
      return {
        key,
        cells,
        actions: await options.rowActions(record),
        ...(url ? { url } : {}),
        selectable: true,
      }
    })
  )
  return { rows: tableRows, meta: metaFrom(meta, rows.length), query: options.normalized }
}
