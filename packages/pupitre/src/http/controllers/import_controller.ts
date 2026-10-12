import { storedJobError } from '../../jobs/error.js'
import { requestMessages, resolveTranslations, t } from '../../i18n.js'
import { publishResourceChange } from '../../realtime.js'
import type { HttpContext } from '@adonisjs/core/http'
import type { MultipartFile } from '@adonisjs/bodyparser'
import type { Database } from '@adonisjs/lucid/database'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import app from '@adonisjs/core/services/app'
import vine from '@vinejs/vine'
import { parse as parseCsv } from 'csv-parse/sync'
import { readUploadBytes } from '../../storage/upload_validation.js'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import type { ActionDefinition } from '../../definition/action.js'
import type { SchemaNodeDefinition } from '../../definition/schema.js'
import type { FieldDefinitionUnion } from '../../definition/schema.js'
import type { ResourceRuntime } from '../../manager.js'
import type PupitreManager from '../../manager.js'
import { authorizeResource } from '../../authz/bouncer.js'
import { compileValidator } from '../../compiler/vine_compiler.js'
import { fillTenantOwnership } from '../../tenancy/runtime.js'
import { requestResource, scopedQuery } from '../../query/scoped_query.js'
import { resourceAttributes, syncRelationshipRepeaters } from '../repeater_relationships.js'
import { createCsvStream, type CsvColumn } from '../../table/csv_stream.js'
import { createPupitreStorage } from '../../storage/index.js'
import { errorJson } from '../responses.js'
import type { ImportResultResponse } from '../../../catalog/wire.js'
import type { PupitreConfig } from '../../define_config.js'
import { authorizeNestedParent, applyNestedOwnership } from './nested_resource_guards.js'
import { walkSchema } from '../../definition/walk.js'
const CSV_MAX_BYTES = 10 * 1024 * 1024
const importableKinds: Record<string, true> = {
  text: true,
  email: true,
  number: true,
  slider: true,
  textarea: true,
  select: true,
  multiSelect: true,
  checkbox: true,
  checkboxList: true,
  radio: true,
  toggle: true,
  toggleButtons: true,
  date: true,
  dateTime: true,
  time: true,
  color: true,
  tags: true,
  keyValue: true,
}

type ImportField = { name: string; label: string; required: boolean }
type CsvRow = Record<string, string>

export function actionDefinition(
  resource: ResourceRuntime,
  name: string
): ActionDefinition | undefined {
  return [
    ...(resource.definition.actions?.header ?? []),
    ...(resource.definition.actions?.bulk ?? []),
  ].find((action) => action.name === name)
}
function isImportableField(node: SchemaNodeDefinition): node is FieldDefinitionUnion {
  return 'kind' in node && 'name' in node && Object.hasOwn(importableKinds, node.kind)
}

function importFields(nodes: SchemaNodeDefinition[]): ImportField[] {
  const fields: ImportField[] = []
  walkSchema(nodes, (node, path) => {
    if (!isImportableField(node)) return
    fields.push({
      name: path,
      label: typeof node.label === 'string' ? node.label : node.name,
      required: node.rules?.required === true,
    })
  })
  return fields
}

async function uploadedCsv(
  ctx: HttpContext,
  maxRows = 100_000
): Promise<{ headers: string[]; rows: CsvRow[] }> {
  const file = ctx.request.file('file') as MultipartFile | null
  if (!file || !file.tmpPath || file.errors.length > 0)
    throw new Error(t('Upload a valid CSV file.'))
  if (file.size > CSV_MAX_BYTES) throw new Error(t('CSV files must be 10 MiB or smaller.'))
  const bytes = await readUploadBytes(file.tmpPath, CSV_MAX_BYTES)
  const parsed = parseCsv(bytes, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as CsvRow[]
  const headers = parsed.length > 0 ? Object.keys(parsed[0]!) : []
  if (headers.length === 0) throw new Error(t('The CSV file must include a header row.'))
  if (parsed.length > maxRows)
    throw new Error(
      t('CSV files cannot contain more than {count} rows on the synchronous path.', {
        count: maxRows,
      })
    )
  return { headers, rows: parsed }
}

function actionAndResource(ctx: HttpContext) {
  const resource = requestResource(ctx, ctx.params.slug)
  if (!resource) return { resource: undefined, action: undefined }
  const action = actionDefinition(resource, String(ctx.request.qs().action ?? 'import'))
  return { resource, action }
}

function primaryKey(model: LucidModel): string {
  return (model as LucidModel & { primaryKey?: string }).primaryKey ?? 'id'
}

function vineMessages(error: unknown): string[] {
  const messages = (error as { messages?: { message?: string }[] })?.messages
  return Array.isArray(messages)
    ? messages.map((message) => message.message ?? t('Invalid value'))
    : [error instanceof Error ? error.message : t('Import failed')]
}
async function persistFailedRows(
  ctx: HttpContext,
  resource: ResourceRuntime,
  rows: Record<string, unknown>[],
  headers: string[]
): Promise<string> {
  const userId = ctx.pupitre.user?.id
  if (userId === undefined)
    throw new Error(t('Authentication is required to save failed import rows.'))
  const id = randomUUID()
  const fileKey = `imports/${id}-failed.csv`
  const columns: CsvColumn[] = [
    ...headers.map((header) => ({ key: header, header })),
    { key: '_errors', header: t('Errors') },
  ]
  const messages = requestMessages.get(ctx) ?? {}
  const stream = createCsvStream(
    rows.map((row) => ({
      ...row,
      _errors: resolveTranslations(row._errors, ctx.pupitre.locale, messages),
    })),
    resolveTranslations(columns, ctx.pupitre.locale, messages)
  )
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const bytes = Buffer.concat(chunks)
  await createPupitreStorage().put(fileKey, bytes, {
    contentType: 'text/csv; charset=utf-8',
    visibility: 'private',
  })
  const now = DateTime.now()
  const tenantId = ctx.pupitre.tenant?.id ?? null
  const database = (await app.container.make('lucid.db')) as Database
  const config = (await app.container.make('pupitre.config')) as PupitreConfig
  await database.table('pupitre_exports').insert({
    id,
    user_id: userId,
    tenant_id: tenantId === null ? null : String(tenantId),
    resource: `import-failures:${resource.slug}`,
    status: 'done',
    total_rows: rows.length,
    processed_rows: rows.length,
    file_key: fileKey,
    error: null,
    created_at: now.toSQL(),
    updated_at: now.toSQL(),
    expires_at: now.plus({ minutes: config.exports?.retentionMinutes ?? 1440 }).toSQL(),
  })
  return `${ctx.pupitre.panel.path}/_pupitre/exports/${id}/download`
}
export async function processImportRows(
  ctx: HttpContext,
  resource: ResourceRuntime,
  action: ActionDefinition,
  rows: CsvRow[],
  headers: string[],
  mapping: Record<string, string>,
  onProgress?: (processed: number) => Promise<void>
): Promise<ImportResultResponse> {
  const form = resource.definition.form ?? []
  const validate = compileValidator(form)
  const fieldsByName = new Map(importFields(form).map((field) => [field.name, field]))
  let created = 0
  let updated = 0
  const failedRows: Record<string, unknown>[] = []
  for (const row of rows) {
    const data = Object.fromEntries(
      Object.entries(mapping).map(([header, field]) => {
        const value = row[header] ?? ''
        const definition = fieldsByName.get(field)
        return [field, definition?.required && value.trim() === '' ? undefined : value]
      })
    )
    try {
      let record = action.resolveRecord ? await action.resolveRecord({ data, ctx }) : null
      if (record) {
        const recordId = record.$primaryKeyValue
        if (recordId === undefined || recordId === null)
          throw new Error(t('The resolved update record has no primary key.'))
        record = await scopedQuery(ctx, resource)
          .where(primaryKey(resource.model), recordId)
          .first()
        if (!record) throw new Error(t('The resolved update record is outside the current scope.'))
        if (!(await authorizeResource(ctx, resource, 'update', record)))
          throw new Error(t('You are not authorized to update this record.'))
      } else if (!(await authorizeResource(ctx, resource, 'create'))) {
        throw new Error(t('You are not authorized to create records.'))
      }
      const validated = await validate.validate(data, {
        record,
        model: resource.model,
        ctx,
        timezone: ctx.pupitre.timezone,
      })
      const updating = record !== null
      await resource.model.transaction(async (trx) => {
        let saved: LucidRow
        if (record) {
          let values =
            (await resource.definition.hooks.mutateBeforeSave?.(validated, record, ctx, trx)) ??
            validated
          values = applyNestedOwnership(ctx, resource, fillTenantOwnership(ctx, resource, values))
          const attributes = resourceAttributes(form, values)
          await resource.definition.hooks.beforeSave?.(record, values, ctx, trx)
          record.useTransaction(trx)
          saved = resource.definition.handlers.update
            ? ((await resource.definition.handlers.update(
                record,
                attributes,
                ctx,
                trx
              )) as LucidRow)
            : ((await record.merge(attributes).save()) as LucidRow)
          saved.useTransaction(trx)
          await syncRelationshipRepeaters(resource, saved, values, trx)
          await resource.definition.hooks.afterSave?.(saved, ctx, trx)
        } else {
          let values =
            (await resource.definition.hooks.mutateBeforeCreate?.(validated, ctx, trx)) ?? validated
          values =
            (await resource.definition.hooks.mutateBeforeSave?.(values, null, ctx, trx)) ?? values
          await resource.definition.hooks.beforeCreate?.(values, ctx, trx)
          await resource.definition.hooks.beforeSave?.(null, values, ctx, trx)
          values = applyNestedOwnership(ctx, resource, fillTenantOwnership(ctx, resource, values))
          const attributes = resourceAttributes(form, values)
          saved = resource.definition.handlers.create
            ? ((await resource.definition.handlers.create(attributes, ctx, trx)) as LucidRow)
            : ((await resource.model.create(attributes, { client: trx })) as LucidRow)
          saved.useTransaction(trx)
          await syncRelationshipRepeaters(resource, saved, values, trx)
          await resource.definition.hooks.afterCreate?.(saved, ctx, trx)
          await resource.definition.hooks.afterSave?.(saved, ctx, trx)
        }
      })
      if (updating) updated++
      else created++
    } catch (error) {
      failedRows.push({ ...row, _errors: vineMessages(error).join('; ') })
    }
    await onProgress?.(created + updated + failedRows.length)
  }
  if (created + updated > 0) await publishResourceChange(ctx, resource.slug)
  const failedRowsUrl = failedRows.length
    ? await persistFailedRows(ctx, resource, failedRows, headers)
    : undefined
  return {
    total: rows.length,
    created,
    updated,
    failed: failedRows.length,
    ...(failedRowsUrl ? { failedRowsUrl } : {}),
  }
}

export default class ImportController {
  async preview(ctx: HttpContext) {
    const { resource, action } = actionAndResource(ctx)
    if (!resource) return errorJson(ctx, t('Resource not found'), 404)
    if (!action || action.builtin !== 'import')
      return errorJson(ctx, t('Import action not found'), 404)
    await authorizeNestedParent(ctx, resource)
    if (
      !(await authorizeResource(ctx, resource, 'create')) ||
      (action.can && !(await authorizeResource(ctx, resource, action.can)))
    )
      return errorJson(ctx, t('You are not authorized to import records'), 403)
    try {
      const csv = await uploadedCsv(ctx)
      return ctx.response.json({
        headers: csv.headers,
        preview: csv.rows.slice(0, 5),
        fields: importFields(resource.definition.form ?? []),
      })
    } catch (error) {
      return errorJson(ctx, error instanceof Error ? error.message : t('Invalid CSV upload'), 422)
    }
  }

  async store(ctx: HttpContext) {
    const { resource, action } = actionAndResource(ctx)
    if (!resource) return errorJson(ctx, t('Resource not found'), 404)
    if (!action || action.builtin !== 'import')
      return errorJson(ctx, t('Import action not found'), 404)
    if (!resource.definition.form)
      return errorJson(ctx, t('This resource does not define a form'), 404)
    await authorizeNestedParent(ctx, resource, true)
    if (
      !(await authorizeResource(ctx, resource, 'create')) ||
      (action.can && !(await authorizeResource(ctx, resource, action.can)))
    )
      return errorJson(ctx, t('You are not authorized to import records'), 403)
    let csv: { headers: string[]; rows: CsvRow[] }
    const config = (await app.container.make('pupitre.config')) as PupitreConfig
    const fields = importFields(resource.definition.form)
    const manager = (await ctx.containerResolver.make('pupitre.manager')) as PupitreManager
    const jobs = action.async ? manager.jobs : undefined
    const maxRows = jobs
      ? (config.exports?.maxAsyncRows ?? 100_000)
      : (config.exports?.maxSyncRows ?? 1000)
    let mapping: Record<string, string>
    try {
      csv = await uploadedCsv(ctx, maxRows)
      const rawMapping = ctx.request.input('mapping')
      const parsedMapping = typeof rawMapping === 'string' ? JSON.parse(rawMapping) : rawMapping
      const allowed = fields.map((field) => field.name)
      const validator = vine.compile(vine.object({ mapping: vine.record(vine.string()) }))
      const validated = await validator.validate({ mapping: parsedMapping })
      mapping = Object.fromEntries(
        Object.entries(validated.mapping).filter(([, field]) => field !== '')
      ) as Record<string, string>
      for (const [header, field] of Object.entries(mapping)) {
        if (!csv.headers.includes(header) || !allowed.includes(field))
          return errorJson(ctx, t('Invalid CSV mapping for column "{header}"', { header }), 422)
      }
      if (Object.keys(mapping).length === 0)
        return errorJson(ctx, t('Map at least one CSV header to a form field'), 422)
    } catch (error) {
      return errorJson(
        ctx,
        error instanceof Error ? error.message : t('Invalid import mapping'),
        422
      )
    }

    if (!jobs) {
      const summary = await processImportRows(ctx, resource, action, csv.rows, csv.headers, mapping)
      return ctx.response.json(summary)
    }

    const userId = ctx.pupitre.user?.id
    if (userId === undefined)
      return errorJson(ctx, t('Authentication is required for queued imports'), 401)
    const tenantId = ctx.pupitre.tenant?.id ?? null
    const importId = randomUUID()
    const progressUrl = `${ctx.pupitre.panel.path}/_pupitre/exports/${importId}`
    const now = DateTime.now()
    const database = (await app.container.make('lucid.db')) as Database
    await database.table('pupitre_exports').insert({
      id: importId,
      user_id: userId,
      tenant_id: tenantId === null ? null : String(tenantId),
      resource: `imports:${resource.slug}`,
      status: 'queued',
      total_rows: csv.rows.length,
      processed_rows: 0,
      file_key: null,
      result: null,
      error: null,
      created_at: now.toSQL(),
      updated_at: now.toSQL(),
      expires_at: now.plus({ minutes: config.exports?.retentionMinutes ?? 1440 }).toSQL(),
    })
    const jobName = 'pupitre.import'
    const file = ctx.request.file('file') as MultipartFile | null
    if (!file?.tmpPath) return errorJson(ctx, t('Upload a valid CSV file.'), 422)
    const fileKey = `imports/${importId}.csv`
    try {
      await createPupitreStorage().put(
        fileKey,
        await readUploadBytes(file.tmpPath, CSV_MAX_BYTES),
        {
          contentType: 'text/csv; charset=utf-8',
          visibility: 'private',
        }
      )
      await jobs.dispatch(jobName, {
        importId,
        panelId: ctx.pupitre.panel.id,
        locale: ctx.pupitre.locale,
        resource: resource.slug,
        action: action.name,
        userId,
        tenantId,
        fileKey,
        mapping,
        params: ctx.params,
        query: ctx.request.qs(),
      })
    } catch (error) {
      await createPupitreStorage().delete(fileKey)
      await database
        .from('pupitre_exports')
        .where('id', importId)
        .update({
          status: 'failed',
          ...storedJobError(error, t('Unable to dispatch import')),
          updated_at: DateTime.now().toSQL(),
        })
      throw error
    }
    return ctx.response.json({ jobId: importId, progressUrl })
  }
}
