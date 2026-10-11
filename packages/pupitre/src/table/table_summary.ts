import type { LucidModel, LucidRow, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { TableColumnDefinition, TableDefinition } from '../definition/table.js'
import { formatMoney, formatNumber } from '../format/index.js'
import type { TableDataOptions } from './table_data.js'
type SummaryOptions = Pick<TableDataOptions, 'locale' | 'timezone' | 'normalized'>

type SummaryValue = number | string
type SummaryMap = Record<string, Record<string, SummaryValue>>
type AggregateRow = Record<string, unknown>

function summaryColumns(table: TableDefinition) {
  return table.columns.filter(
    (column): column is Exclude<TableColumnDefinition, { kind: 'fragment' }> =>
      column.kind !== 'fragment' && Boolean(column.summaries?.length)
  )
}

function fieldExpression(query: ModelQueryBuilderContract<LucidModel, LucidRow>, name: string) {
  const [relationName, attribute] = name.split('.', 2)
  if (!relationName || !attribute) return query.model.$getColumn(name)?.columnName ?? name
  const relation = query.model.$getRelation(relationName)
  relation.boot()
  const { sql, bindings } = relation.subQuery(query.client).select(attribute).prepare().toSQL()
  return query.client.getReadClient().raw(`(${sql})`, bindings)
}

function formatted(
  value: unknown,
  column: Exclude<TableColumnDefinition, { kind: 'fragment' }>,
  options: SummaryOptions
) {
  const number = Number(value ?? 0)
  return column.kind === 'text' && column.money
    ? (formatMoney(number, { locale: options.locale }, { currency: column.money }) ?? '')
    : (formatNumber(number, { locale: options.locale }) ?? '')
}

function toSummary(
  row: AggregateRow,
  table: TableDefinition,
  options: SummaryOptions
): Record<string, Record<string, SummaryValue>> {
  const result: Record<string, Record<string, SummaryValue>> = {}
  for (const column of summaryColumns(table)) {
    const values: Record<string, SummaryValue> = {}
    for (const kind of column.summaries ?? []) {
      if (kind === 'range') {
        const min = row[`${column.name}__min`]
        const max = row[`${column.name}__max`]
        values.range =
          min === null || min === undefined || max === null || max === undefined
            ? '—'
            : `${formatted(min, column, options)} – ${formatted(max, column, options)}`
        continue
      }
      values[kind] = formatted(row[`${column.name}__${kind}`], column, options)
    }
    result[column.name] = values
  }
  return result
}

/** Aggregate the already-scoped and filtered query in SQL, never materializing matching models. */
export async function aggregateTableSummaries(
  query: ModelQueryBuilderContract<LucidModel, LucidRow>,
  table: TableDefinition,
  options: SummaryOptions
): Promise<{ summary?: SummaryMap; groups?: Record<string, SummaryMap>; sql?: string }> {
  const columns = summaryColumns(table)
  if (!columns.length) return {}
  const groupKey =
    typeof options.normalized.groupBy === 'string' ? options.normalized.groupBy : undefined
  const aggregate = query.clone().clearSelect().clearOrder()
  if (groupKey) {
    const groupExpression = fieldExpression(aggregate, groupKey)
    aggregate
      .select({ __summary_group: groupExpression as never })
      .groupBy(groupExpression as never)
  }
  const aliases: Record<string, string> = {}
  for (const [index, column] of columns.entries()) {
    const field = fieldExpression(aggregate, column.name)
    const alias = (kind: string) => {
      const key = `__summary_${index}__${kind}`
      aliases[key] = `${column.name}__${kind}`
      return key
    }
    for (const kind of column.summaries ?? []) {
      if (kind === 'range') {
        aggregate.min({ [alias('min')]: field as never })
        aggregate.max({ [alias('max')]: field as never })
      } else if (kind === 'count') {
        aggregate.count({ [alias('count')]: field as never })
      } else if (kind === 'sum') {
        aggregate.sum({ [alias('sum')]: field as never })
      } else if (kind === 'avg') {
        aggregate.avg({ [alias('avg')]: field as never })
        if (groupKey) aggregate.count({ [alias('avg_count')]: field as never })
      } else if (kind === 'min') {
        aggregate.min({ [alias('min')]: field as never })
      } else if (kind === 'max') {
        aggregate.max({ [alias('max')]: field as never })
      }
    }
  }
  const sql = aggregate.toQuery()
  const rows = (await aggregate.pojo().exec()) as AggregateRow[]
  for (const [alias, key] of Object.entries(aliases)) {
    for (const row of rows) {
      row[key] = row[alias]
      delete row[alias]
    }
  }
  if (!groupKey) return { summary: toSummary(rows[0] ?? {}, table, options), sql }
  const groups: Record<string, SummaryMap> = {}
  const [relationName, relatedAttribute] = groupKey.split('.', 2)
  const model = relatedAttribute
    ? (query.model.$getRelation(relationName!).relatedModel() as LucidModel)
    : query.model
  const attribute = relatedAttribute ?? groupKey
  const column = model.$getColumn(attribute)
  const groupedRows = new Map<string, AggregateRow>()
  for (const row of rows) {
    // Consume and serialize the driver value exactly as a displayed row does.
    // Only one attribute per SQL group is hydrated, not the matching result set.
    const serialized = model
      .$createFromAdapterResult({ [column?.columnName ?? attribute]: row.__summary_group })
      ?.serializeAttributes()
    const value = serialized?.[attribute]
    const key = value === null || value === undefined ? '' : String(value)
    const existing = groupedRows.get(key)
    if (!existing) {
      groupedRows.set(key, row)
      continue
    }
    for (const summaryColumn of columns) {
      const kinds = new Set(summaryColumn.summaries ?? [])
      if (kinds.has('avg')) {
        const averageKey = `${summaryColumn.name}__avg`
        const countKey = `${summaryColumn.name}__avg_count`
        const leftCount = Number(existing[countKey] ?? 0)
        const rightCount = Number(row[countKey] ?? 0)
        const totalCount = leftCount + rightCount
        existing[averageKey] = totalCount
          ? (Number(existing[averageKey] ?? 0) * leftCount +
              Number(row[averageKey] ?? 0) * rightCount) /
            totalCount
          : null
        existing[countKey] = totalCount
      }
      for (const kind of ['sum', 'count', 'min', 'max'] as const) {
        if (!kinds.has(kind) && !(kinds.has('range') && (kind === 'min' || kind === 'max')))
          continue
        const valueKey = `${summaryColumn.name}__${kind}`
        const left = existing[valueKey]
        const right = row[valueKey]
        if (kind === 'sum' || kind === 'count') {
          existing[valueKey] = Number(left ?? 0) + Number(right ?? 0)
        } else if (left === null || left === undefined) {
          existing[valueKey] = right
        } else if (right !== null && right !== undefined) {
          existing[valueKey] =
            kind === 'min'
              ? Math.min(Number(left), Number(right))
              : Math.max(Number(left), Number(right))
        }
      }
    }
  }
  for (const [key, row] of groupedRows) groups[key] = toSummary(row, table, options)
  return { groups, sql }
}
