import { t } from '../i18n.js'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { ActionDefinition } from '../definition/action.js'
import type { ResourceRuntime } from '../manager.js'
import type { TableDefinition } from '../definition/table.js'
import { applyTableQuery, parseTableParams } from '../query/table_query.js'
import { scopedQuery } from '../query/scoped_query.js'
import { buildTableData } from './table_data.js'
import type { CsvColumn } from './csv_stream.js'

function rawValue(record: LucidRow, name: string): unknown {
  let value: unknown = record.serialize()
  for (const part of name.split('.')) {
    if (!value || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[part]
  }
  return value
}

function csvValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ')
  if (typeof value === 'object' && 'text' in value) return String(value.text ?? '')
  return JSON.stringify(value)
}

export type ExportQuery = {
  params: Record<string, unknown>
  prefix?: string
  ids?: Array<string | number>
  trashed?: 'only' | 'with'
}

function exportQuery(
  ctx: HttpContext,
  resource: ResourceRuntime,
  table: TableDefinition,
  input: ExportQuery,
  preloadRelations = true
) {
  const params = parseTableParams(input.params, input.prefix)
  const filters =
    params.filters && typeof params.filters === 'object'
      ? (params.filters as Record<string, unknown>)
      : {}
  const trashed =
    input.trashed ??
    (filters.trashed === 'only' || filters.trashed === 'with' ? filters.trashed : undefined)
  const query = scopedQuery(ctx, resource, { trashed })
  if (input.ids)
    query.whereIn(
      (resource.model as LucidModel & { primaryKey?: string }).primaryKey ?? 'id',
      input.ids
    )
  if (preloadRelations) {
    for (const column of table.columns) {
      if (column.kind === 'fragment' || !column.name.includes('.')) continue
      const relation = column.name.split('.')[0]!
      if (resource.model.$getRelation(relation)) query.preload(relation as never)
    }
  }
  const queryResult = applyTableQuery(query, table, params, {
    ctx,
    tabs: resource.definition.pages.list?.tabs,
  })
  return { queryResult, params }
}

export async function countExportRows(
  ctx: HttpContext,
  resource: ResourceRuntime,
  table: TableDefinition,
  input: ExportQuery,
  requireAllSelected = true
): Promise<number> {
  const { queryResult } = exportQuery(ctx, resource, table, input, false)
  const count = await queryResult.query.clone().clearOrder().count('* as total').pojo().first()
  const countRow = count as unknown as {
    total?: string | number
    $attributes?: { total?: string | number }
  } | null
  const total = Number(countRow?.total ?? countRow?.$attributes?.total ?? 0)
  if (requireAllSelected && input.ids && total !== input.ids.length)
    throw new Error(t('One or more selected records were not found in the current scope'))
  return total
}

/** Runs the exact scoped table query and formats rows in bounded model batches. */
export async function* exportBatches(
  ctx: HttpContext,
  resource: ResourceRuntime,
  action: ActionDefinition,
  table: TableDefinition,
  columns: CsvColumn[],
  input: ExportQuery
): AsyncGenerator<{
  rows: Record<string, string | number | boolean | null>[]
  processed: number
  total: number
}> {
  const { queryResult } = exportQuery(ctx, resource, table, input)
  const total = await countExportRows(ctx, resource, table, input, false)
  // A unique final sort keeps non-unique/default sorts deterministic across batches.
  if (!table.multiSort) queryResult.query.orderBy(resource.model.primaryKey, 'asc')
  const formatters = new Map(
    (action.exportColumns ?? []).map((column) => [column.name, column.formatStateUsing])
  )
  const batchSize = 500
  let processed = 0
  for (let offset = 0; ; offset += batchSize) {
    const records = await queryResult.query.clone().offset(offset).limit(batchSize).exec()
    if (records.length === 0) break
    processed += records.length
    const tableData = await buildTableData(table, records, total, {
      ctx,
      locale: ctx.pupitre.locale,
      timezone: ctx.pupitre.timezone,
      normalized: queryResult.normalized,
      rowActions: async () => [],
      rowUrl: () => undefined,
    })
    const batchRows: Record<string, string | number | boolean | null>[] = []
    for (const [index, record] of records.entries()) {
      const row: Record<string, string | number | boolean | null> = {}
      for (const column of columns) {
        const formatter = formatters.get(column.key)
        const raw = rawValue(record, column.key)
        const formatted = formatter ? await formatter(raw, record) : undefined
        row[column.key] = csvValue(
          formatter ? formatted : (tableData.rows[index]?.cells[column.key] ?? raw)
        )
      }
      batchRows.push(row)
    }
    yield { rows: batchRows, processed, total: Math.max(processed, total) }
  }
}

export async function processExport(
  ctx: HttpContext,
  resource: ResourceRuntime,
  action: ActionDefinition,
  table: TableDefinition,
  columns: CsvColumn[],
  input: ExportQuery,
  onBatch?: (
    rows: Record<string, string | number | boolean | null>[],
    processed: number,
    total: number
  ) => Promise<void>
): Promise<{ total: number; rows: Record<string, string | number | boolean | null>[] }> {
  const rows: Record<string, string | number | boolean | null>[] = []
  let processed = 0
  for await (const batch of exportBatches(ctx, resource, action, table, columns, input)) {
    processed = batch.processed
    if (onBatch) await onBatch(batch.rows, batch.processed, batch.total)
    else rows.push(...batch.rows)
  }
  return { total: processed, rows }
}
