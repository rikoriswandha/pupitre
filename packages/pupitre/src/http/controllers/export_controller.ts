import { captureTranslation, requestMessages, resolveTranslations, t } from '../../i18n.js'
import { storedJobError } from '../../jobs/error.js'
import type { HttpContext } from '@adonisjs/core/http'
import { QsParserFactory } from '@adonisjs/core/factories/http'
import type { Database } from '@adonisjs/lucid/database'
import app from '@adonisjs/core/services/app'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import type { PupitreConfig } from '../../define_config.js'
import type { ActionDefinition } from '../../definition/action.js'
import type { ResourceRuntime } from '../../manager.js'
import type PupitreManager from '../../manager.js'
import { authorizeResource } from '../../authz/bouncer.js'
import { requestResource } from '../../query/scoped_query.js'
import { countExportRows, processExport } from '../../table/export_service.js'
import { createCsvStream } from '../../table/csv_stream.js'
import type { CsvColumn } from '../../table/csv_stream.js'
import type { TableColumnDefinition } from '../../definition/table.js'
import { errorJson } from '../responses.js'
import { requestedPageUrl } from '../return_url.js'
import { authorizeNestedParent } from './nested_resource_guards.js'

function actionDefinition(resource: ResourceRuntime, name: string): ActionDefinition | undefined {
  return [
    ...(resource.definition.actions?.header ?? []),
    ...(resource.definition.actions?.bulk ?? []),
  ].find((action) => action.name === name)
}

function currentQuery(ctx: HttpContext): Record<string, unknown> {
  const input = ctx.request.input('query')
  if (input && typeof input === 'object' && !Array.isArray(input))
    return input as Record<string, unknown>
  const currentUrl = requestedPageUrl(ctx)
  if (!currentUrl) return ctx.request.qs()
  const query = new URL(currentUrl, 'http://pupitre.local').search.slice(1)
  return new QsParserFactory().create().parse(query) as Record<string, unknown>
}

export default class ExportController {
  async run(ctx: HttpContext) {
    const resource = await requestResource(ctx, ctx.params.slug)
    if (!resource) return errorJson(ctx, t('Resource not found'), 404)
    const action = actionDefinition(resource, String(ctx.request.qs().action ?? 'export'))
    if (!action || action.builtin !== 'export')
      return errorJson(ctx, t('Export action not found'), 404)
    const table = resource.definition.table
    if (!table) return errorJson(ctx, t('This resource does not define a table'), 404)
    await authorizeNestedParent(ctx, resource)
    if (
      !(await authorizeResource(ctx, resource, 'viewAny')) ||
      (action.can && !(await authorizeResource(ctx, resource, action.can)))
    )
      return errorJson(ctx, t('You are not authorized to export these records'), 403)

    const requestedIds = ctx.request.input('ids')
    if (
      requestedIds !== undefined &&
      (!Array.isArray(requestedIds) ||
        requestedIds.length === 0 ||
        requestedIds.some((id) => typeof id !== 'string' && typeof id !== 'number'))
    )
      return errorJson(ctx, t('Select at least one record to export'), 422)
    const selectedColumns = action.exportColumns?.length
      ? action.exportColumns
      : table.columns
          .filter(
            (column): column is Exclude<TableColumnDefinition, { kind: 'fragment' }> =>
              column.kind !== 'fragment' && !column.toggleable?.hiddenByDefault
          )
          .map((column) => ({ name: column.name, label: column.label }))
    const requestedColumns = ctx.request.input('columns')
    const columns =
      Array.isArray(requestedColumns) && requestedColumns.every((name) => typeof name === 'string')
        ? selectedColumns.filter((column) => requestedColumns.includes(column.name))
        : selectedColumns
    if (columns.length === 0) return errorJson(ctx, t('No exportable columns were selected'), 422)

    const prefixValue = ctx.request.input('prefix')
    const prefix = typeof prefixValue === 'string' ? prefixValue : undefined
    const input = {
      params: currentQuery(ctx),
      ...(prefix ? { prefix } : {}),
      ...(Array.isArray(requestedIds) ? { ids: requestedIds as (string | number)[] } : {}),
    }
    const count = await countExportRows(ctx, resource, table, input)
    const config = (await app.container.make('pupitre.config')) as PupitreConfig
    const manager = (await ctx.containerResolver.make('pupitre.manager')) as PupitreManager
    const jobs = manager.jobs
    const maxSyncRows = config.exports?.maxSyncRows ?? 1000
    const maxAsyncRows = config.exports?.maxAsyncRows ?? 100_000
    if (count > maxAsyncRows && jobs)
      return errorJson(
        ctx,
        t('This export exceeds the configured asynchronous limit of {count} rows.', {
          count: maxAsyncRows,
        }),
        413
      )
    if (count > maxSyncRows && !jobs)
      return errorJson(
        ctx,
        t(
          'This export exceeds the synchronous limit of {count} rows. Configure a jobs adapter for larger exports.',
          { count: maxSyncRows }
        ),
        413
      )

    const csvColumns: CsvColumn[] = columns.map((column) => ({
      key: column.name,
      header: column.label ?? column.name,
    }))
    if (jobs && count > maxSyncRows) {
      const userId = ctx.pupitre.user?.id
      if (userId === undefined)
        return errorJson(ctx, t('Authentication is required for exports'), 401)
      const exportId = randomUUID()
      const fileKey = `exports/${exportId}.csv`
      const progressUrl = `${ctx.pupitre.panel.path}/_pupitre/exports/${exportId}`
      const downloadUrl = `${progressUrl}/download`
      const tenantId = ctx.pupitre.tenant?.id ?? null
      const now = DateTime.now()
      const database = (await app.container.make('lucid.db')) as Database
      await database.table('pupitre_exports').insert({
        id: exportId,
        user_id: userId,
        tenant_id: tenantId === null ? null : String(tenantId),
        resource: resource.slug,
        result: JSON.stringify({ action: action.name }),
        status: 'queued',
        total_rows: count,
        processed_rows: 0,
        file_key: null,
        error: null,
        created_at: now.toSQL(),
        updated_at: now.toSQL(),
        expires_at: now.plus({ minutes: config.exports?.retentionMinutes ?? 1440 }).toSQL(),
      })
      try {
        await jobs.dispatch('pupitre.export', {
          id: exportId,
          panelId: ctx.pupitre.panel.id,
          locale: ctx.pupitre.locale,
          resource: resource.slug,
          action: action.name,
          userId,
          tenantId,
          params: ctx.params,
          query: input.params,
          data: {},
          fileKey,
          progressUrl,
          downloadUrl,
          totalRows: count,
          columns: csvColumns.map((column) => {
            const captured = captureTranslation(column.header)
            return { ...column, header: captured.text, translation: captured.translation }
          }),
          queryOptions: input,
        })
      } catch (error) {
        await database
          .from('pupitre_exports')
          .where('id', exportId)
          .update({
            status: 'failed',
            ...storedJobError(
              error,
              t('Unable to dispatch export'),
              JSON.stringify({ action: action.name })
            ),
            updated_at: DateTime.now().toSQL(),
          })
        throw error
      }
      return ctx.response.json({ jobId: exportId, progressUrl, downloadUrl })
    }
    const result = await processExport(ctx, resource, action, table, csvColumns, input)
    if (result.total !== count) throw new Error('The export result set changed during processing')
    const messages = requestMessages.get(ctx) ?? {}
    const localizedColumns = resolveTranslations(csvColumns, ctx.pupitre.locale, messages)
    const stream = createCsvStream(
      resolveTranslations(result.rows, ctx.pupitre.locale, messages),
      localizedColumns
    )
    ctx.response.header('Content-Type', 'text/csv; charset=utf-8')
    ctx.response.header('X-Content-Type-Options', 'nosniff')
    ctx.response.header(
      'Content-Disposition',
      `attachment; filename="${resource.slug}-${new Date().toISOString().slice(0, 10)}.csv"`
    )
    return ctx.response.stream(stream)
  }
}
