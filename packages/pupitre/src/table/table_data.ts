import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { HttpContext } from '@adonisjs/core/http'
import type { ActionDescriptor, TableData, TableMeta, TableRow } from '../../catalog/wire.js'
import type { TableColumnDefinition, TableDefinition } from '../definition/table.js'
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatSince,
  formatOption,
  resolveTimezone,
  truncate,
} from '../format/index.js'

export type TableSummary = Record<string, Record<string, number | string>>
export type TableDataOptions = {
  ctx?: HttpContext
  locale: string
  timezone: string
  rowActions(record: LucidRow): Promise<ActionDescriptor[]>
  rowUrl(record: LucidRow): string | undefined
  normalized: Record<string, unknown>
  resolveFileUrl?: (key: string, column: TableColumnDefinition) => Promise<string | null>
  summaryRows?: LucidRow[]
  summary?: TableSummary
  groupSummaries?: Record<string, TableSummary>
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
function editableDisplay(column: TableColumnDefinition, value: unknown): string {
  if ((column.kind === 'toggle' || column.kind === 'checkbox') && typeof value === 'boolean')
    return value ? 'On' : 'Off'
  if (column.kind === 'select' && column.options)
    return stringValue(formatOption(value, column.options))
  return stringValue(value)
}

async function formatCell(
  column: TableColumnDefinition,
  record: LucidRow,
  serialized: Record<string, unknown>,
  options: TableDataOptions
): Promise<unknown> {
  const value =
    column.kind !== 'fragment' && column.countRelation
      ? (record.$extras?.[`${column.countRelation}_count`] ?? valueAt(serialized, column.name))
      : column.kind === 'fragment'
        ? undefined
        : valueAt(serialized, column.name)
  if (column.kind === 'badge') {
    return {
      value,
      ...(column.options ? { label: formatOption(value, column.options) } : {}),
      color: column.colors?.[stringValue(value)],
    }
  }
  if (column.kind === 'icon') {
    return {
      value,
      icon: column.icons?.[stringValue(value)],
      color: column.colors?.[stringValue(value)],
    }
  }
  if (column.kind === 'image') {
    if (Array.isArray(value)) {
      if (!options.resolveFileUrl) return value
      return Promise.all(
        value.map(async (item) => {
          if (typeof item !== 'string' || !item) return item
          return (await options.resolveFileUrl!(item, column)) ?? item
        })
      )
    }
    if (typeof value !== 'string' || !value) return value
    return options.resolveFileUrl ? ((await options.resolveFileUrl(value, column)) ?? value) : value
  }
  if (column.kind !== 'text') return value
  const context = {
    locale: options.locale,
    timezone:
      column.kind === 'text'
        ? resolveTimezone(column.timezone, options.timezone)
        : options.timezone,
  }
  // Option labels replace number/date formatting but still get limit/description/url.
  const display = column.options ? formatOption(value, column.options) : value
  if (!column.options) {
    if (column.money)
      return formatMoney(value as string | number | null, context, { currency: column.money })
    if (column.numeric) return formatNumber(value as string | number | null, context)
    if (column.dateTime) return formatDateTime(value as string | Date | null, context)
    if (column.date) return formatDate(value as string | Date | null, context)
    if (column.since) return formatSince(value as string | Date | null, context)
  }
  if (column.description || column.url || column.limit !== undefined) {
    return {
      value: column.limit !== undefined ? truncate(display, column.limit) : display,
      ...(column.description ? { description: await column.description({ record }) } : {}),
      ...(column.url ? { url: await column.url({ record, ctx: options.ctx }) } : {}),
    }
  }
  return display
}
function safeClassName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const tokens = value
    .split(/\s+/)
    .filter((token) => token.length > 0 && /^[A-Za-z0-9_-]+$/.test(token))
  return tokens.length ? tokens.join(' ') : undefined
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
function aggregateSummary(
  table: TableDefinition,
  records: LucidRow[],
  options: TableDataOptions
): Record<string, Record<string, number | string>> | undefined {
  const columns = table.columns.filter(
    (column): column is Exclude<TableColumnDefinition, { kind: 'fragment' }> =>
      column.kind !== 'fragment' && 'summaries' in column && Boolean(column.summaries?.length)
  )
  if (!columns.length) return undefined
  const summary: Record<string, Record<string, number | string>> = {}
  for (const column of columns) {
    const values = records
      .map((record) => valueAt(record.serialize() as Record<string, unknown>, column.name))
      .map(Number)
      .filter(Number.isFinite)
    const result: Record<string, number | string> = {}
    for (const kind of column.summaries ?? []) {
      const sum = values.reduce((total, item) => total + item, 0)
      const value =
        kind === 'count'
          ? values.length
          : kind === 'sum'
            ? sum
            : kind === 'avg'
              ? values.length
                ? sum / values.length
                : 0
              : kind === 'min'
                ? values.length
                  ? Math.min(...values)
                  : 0
                : kind === 'max'
                  ? values.length
                    ? Math.max(...values)
                    : 0
                  : undefined
      if (kind === 'range') {
        result[kind] = values.length
          ? `${formatNumber(Math.min(...values), { locale: options.locale }) ?? ''} – ${formatNumber(Math.max(...values), { locale: options.locale }) ?? ''}`
          : '—'
      } else if (value !== undefined) {
        result[kind] =
          column.kind === 'text' && column.money
            ? (formatMoney(value, { locale: options.locale }, { currency: column.money }) ?? '')
            : (formatNumber(value, { locale: options.locale }) ?? '')
      }
    }
    summary[column.name] = result
  }
  return summary
}

export async function buildTableData(
  table: TableDefinition,
  rows: LucidRow[],
  meta: unknown,
  options: TableDataOptions
): Promise<TableData> {
  const serializedRows = rows.map((record) => ({
    record,
    serialized: record.serialize() as Record<string, unknown>,
  }))
  const tableRows: TableRow[] = await Promise.all(
    serializedRows.map(async ({ record, serialized }) => {
      const cells: Record<string, unknown> = {}
      for (const column of table.columns) {
        const name = column.kind === 'fragment' ? column.component : column.name
        if ('editable' in column && column.editable) {
          const rawValue = valueAt(serialized, column.name)
          const value =
            column.kind === 'toggle' || column.kind === 'checkbox'
              ? rawValue === true || rawValue === 1 || rawValue === '1'
              : rawValue
          cells[name] = {
            value,
            display: editableDisplay(column, value),
            ...(column.disabled?.({ record: serialized }) ? { disabled: true } : {}),
          }
        } else {
          cells[name] = await formatCell(column, record, serialized, options)
        }
      }
      const key = record.$primaryKeyValue
      if (typeof key !== 'string' && typeof key !== 'number') {
        throw new Error('Table rows require a Lucid primary key')
      }
      const url =
        table.recordUrl === false
          ? undefined
          : typeof table.recordUrl === 'function'
            ? table.recordUrl({ record })
            : options.rowUrl(record)
      const className = safeClassName(table.rowClass?.({ record }))
      return {
        key,
        cells,
        actions: await options.rowActions(record),
        ...(url ? { url } : {}),
        ...(className ? { className } : {}),
        selectable: true,
      }
    })
  )
  const queryGroup = options.normalized.groupBy
  const activeGroup =
    typeof queryGroup === 'string' ? table.groups?.find((group) => group.key === queryGroup) : null
  const summaryRows = options.summaryRows ?? rows
  const hasSummaries = table.columns.some(
    (column) => column.kind !== 'fragment' && column.summaries?.length
  )
  const summary = hasSummaries
    ? (options.summary ?? aggregateSummary(table, summaryRows, options))
    : undefined
  // Group headers reuse the option labels of the same-named column (e.g. `status`).
  const groupColumn = activeGroup
    ? table.columns.find(
        (column) =>
          column.kind !== 'fragment' &&
          column.name === activeGroup.key &&
          'options' in column &&
          column.options !== undefined
      )
    : undefined
  const groupOptions = groupColumn && 'options' in groupColumn ? groupColumn.options : undefined
  const groups = activeGroup
    ? (() => {
        const grouped = new Map<string, { label: string; rows: TableRow[] }>()
        serializedRows.forEach(({ serialized }, index) => {
          const raw = valueAt(serialized, activeGroup.key)
          const key = raw === null || raw === undefined ? '' : String(raw)
          const display = key && groupOptions ? String(formatOption(raw, groupOptions)) : key
          const item = grouped.get(key) ?? {
            label: activeGroup.label ? `${activeGroup.label}: ${display || '—'}` : display || '—',
            rows: [],
          }
          item.rows.push(tableRows[index]!)
          grouped.set(key, item)
        })
        return [...grouped].map(([key, group]) => {
          const groupRecords =
            options.groupSummaries?.[key] === undefined
              ? summaryRows.filter((record) => {
                  const value = valueAt(
                    record.serialize() as Record<string, unknown>,
                    activeGroup.key
                  )
                  return (value === null || value === undefined ? '' : String(value)) === key
                })
              : undefined
          const groupSummary =
            options.groupSummaries?.[key] ?? aggregateSummary(table, groupRecords ?? [], options)
          return { key, ...group, ...(groupSummary ? { summary: groupSummary } : {}) }
        })
      })()
    : undefined
  return {
    rows: tableRows,
    meta: metaFrom(meta, rows.length),
    ...(summary ? { summary } : {}),
    ...(groups ? { groups } : {}),
    query: options.normalized,
  }
}
