import { storedJobError } from '../jobs/error.js'
import {
  getMessages,
  resolveTranslations,
  restoreTranslation,
  t,
  type StoredTranslation,
} from '../i18n.js'
import app from '@adonisjs/core/services/app'
import type { Database } from '@adonisjs/lucid/database'
import { DateTime } from 'luxon'
import { resolveAdapter } from '../define_config.js'
import type { PupitreConfig } from '../define_config.js'
import type { JobsAdapter } from '../adapters/jobs.js'
import type { NotificationsAdapter } from '../adapters/notifications.js'
import { createCsvStream, type CsvColumn } from './csv_stream.js'
import { createXlsxStream, xlsxContentType } from './xlsx_stream.js'
import { createPupitreStorage } from '../storage/index.js'
import type PupitreManager from '../manager.js'
import { createJobContext, type PupitreJobContextPayload } from '../jobs/job_context.js'
import { exportBatches, type ExportQuery } from './export_service.js'
import { authorizeNestedParent } from '../http/controllers/nested_resource_guards.js'
import { authorizeResource } from '../authz/bouncer.js'
import { publishUserNotification } from '../realtime.js'

type ExportJobPayload = PupitreJobContextPayload & {
  id: string
  resource: string
  action: string
  format?: 'csv' | 'xlsx'
  fileKey: string
  progressUrl: string
  downloadUrl: string
  totalRows: number
  columns: (CsvColumn & { translation?: StoredTranslation })[]
  queryOptions: ExportQuery
}

async function notifyCompleted(config: PupitreConfig, payload: ExportJobPayload) {
  const notifications = await resolveAdapter<NotificationsAdapter>(config.notifications)
  if (!notifications || !config.auth.model) return
  const userModule = await config.auth.model()
  const user = await userModule.default.find(payload.userId)
  if (!user) return
  await notifications.toInbox(
    user,
    { type: 'success', title: t('Your export is ready'), url: payload.downloadUrl },
    undefined
  )
  const manager = (await app.container.make('pupitre.manager')) as PupitreManager
  await publishUserNotification(manager, payload.userId)
}

/** Registers the serializable export worker handler with the configured jobs adapter. */
export async function registerExportJob(jobs: JobsAdapter, manager: PupitreManager) {
  jobs.register('pupitre.export', async (rawPayload) => {
    const payload = rawPayload as unknown as ExportJobPayload
    const database = (await app.container.make('lucid.db')) as Database
    const jobRow = await database.from('pupitre_exports').where('id', payload.id).first()
    if (
      !jobRow ||
      String(jobRow.user_id) !== String(payload.userId) ||
      String(jobRow.tenant_id ?? '') !== String(payload.tenantId ?? '')
    )
      throw new Error('Queued export owner or tenant changed')
    try {
      const { ctx, resource } = await createJobContext(manager, payload)
      const action = [
        ...(resource.definition.actions?.header ?? []),
        ...(resource.definition.actions?.bulk ?? []),
      ].find((item) => item.name === payload.action && item.builtin === 'export')
      const table = resource.definition.table
      if (!action || !table) throw new Error(t('Queued export definition is unavailable'))
      if (
        jobRow.resource !== resource.slug ||
        JSON.parse(jobRow.result ?? 'null')?.action !== action.name
      )
        throw new Error(t('Queued export action changed'))
      const format = payload.format ?? 'csv'
      if (
        JSON.parse(jobRow.result ?? 'null')?.format !== payload.format ||
        !(action.exportFormats ?? ['csv']).includes(format) ||
        payload.fileKey !== `exports/${payload.id}.${format}`
      )
        throw new Error(t('Queued export action changed'))
      await authorizeNestedParent(ctx, resource)
      if (!(await authorizeResource(ctx, resource, 'viewAny')))
        throw new Error(t('You are not authorized to export these records'))
      if (action.can && !(await authorizeResource(ctx, resource, action.can)))
        throw new Error(t('You are not authorized to export these records'))
      await database
        .from('pupitre_exports')
        .where('id', payload.id)
        .update({ status: 'processing', updated_at: DateTime.now().toSQL() })
      const config = (await app.container.make('pupitre.config')) as PupitreConfig
      const maxRows = config.exports?.maxAsyncRows ?? 100_000
      const locale = payload.locale ?? ctx.pupitre.locale
      const messages = getMessages(config, ctx.pupitre.panel, locale)
      const columns = resolveTranslations(
        payload.columns.map((column) => ({
          ...column,
          header: restoreTranslation(column.header, column.translation),
        })),
        locale,
        messages
      )
      let processedRows = 0
      async function* rows() {
        for await (const batch of exportBatches(
          ctx,
          resource,
          action!,
          table!,
          payload.columns,
          payload.queryOptions
        )) {
          if (batch.total > maxRows)
            throw new Error(t('The export exceeds the asynchronous row limit'))
          for (const row of resolveTranslations(batch.rows, locale, messages)) yield row
          processedRows = batch.processed
          await database.from('pupitre_exports').where('id', payload.id).update({
            total_rows: batch.total,
            processed_rows: batch.processed,
            updated_at: DateTime.now().toSQL(),
          })
        }
      }
      const stream =
        format === 'xlsx'
          ? createXlsxStream(rows(), columns, resource.slug)
          : createCsvStream(rows(), columns)
      let sourceError: Error | undefined
      stream.on('error', (error) => {
        sourceError = error
      })
      const storage = createPupitreStorage()
      try {
        await storage.putStream(payload.fileKey, stream, {
          contentType: format === 'xlsx' ? xlsxContentType : 'text/csv; charset=utf-8',
          visibility: 'private',
        })
      } catch (error) {
        try {
          await storage.delete(payload.fileKey)
        } catch (cleanupError) {
          const logger = await app.container.make('logger')
          logger.warn(
            { err: cleanupError, exportId: payload.id },
            'Unable to remove failed export file'
          )
        }
        throw sourceError ?? error
      }
      await database.from('pupitre_exports').where('id', payload.id).update({
        status: 'done',
        total_rows: processedRows,
        processed_rows: processedRows,
        file_key: payload.fileKey,
        updated_at: DateTime.now().toSQL(),
      })
    } catch (error) {
      await database
        .from('pupitre_exports')
        .where('id', payload.id)
        .update({
          status: 'failed',
          ...storedJobError(error, t('Export failed'), jobRow.result),
          updated_at: DateTime.now().toSQL(),
        })
      throw error
    }
    // Delivery errors must not make an already downloadable export inaccessible.
    try {
      const config = (await app.container.make('pupitre.config')) as PupitreConfig
      await notifyCompleted(config, payload)
    } catch (error) {
      const logger = await app.container.make('logger')
      logger.warn({ err: error, exportId: payload.id }, 'Unable to notify export owner')
    }
  })
}
