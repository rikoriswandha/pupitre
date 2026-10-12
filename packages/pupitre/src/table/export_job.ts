import app from '@adonisjs/core/services/app'
import type { Database } from '@adonisjs/lucid/database'
import { DateTime } from 'luxon'
import { resolveAdapter } from '../define_config.js'
import type { PupitreConfig } from '../define_config.js'
import type { JobsAdapter } from '../adapters/jobs.js'
import type { NotificationsAdapter } from '../adapters/notifications.js'
import { createCsvStream, type CsvColumn } from './csv_stream.js'
import { createPupitreStorage } from '../storage/index.js'
import type PupitreManager from '../manager.js'
import { createJobContext, type PupitreJobContextPayload } from '../jobs/job_context.js'
import { processExport, type ExportQuery } from './export_service.js'
import { authorizeNestedParent } from '../http/controllers/nested_resource_guards.js'
import { authorizeResource } from '../authz/bouncer.js'
import { publishUserNotification } from '../realtime.js'

type ExportJobPayload = PupitreJobContextPayload & {
  id: string
  resource: string
  action: string
  fileKey: string
  progressUrl: string
  downloadUrl: string
  totalRows: number
  columns: CsvColumn[]
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
    { type: 'success', title: 'Your export is ready', url: payload.downloadUrl },
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
      if (!action || !table) throw new Error('Queued export definition is unavailable')
      if (
        jobRow.resource !== resource.slug ||
        JSON.parse(jobRow.result ?? 'null')?.action !== action.name
      )
        throw new Error('Queued export action changed')
      await authorizeNestedParent(ctx, resource)
      if (!(await authorizeResource(ctx, resource, 'viewAny')))
        throw new Error('You are not authorized to export these records')
      if (action.can && !(await authorizeResource(ctx, resource, action.can)))
        throw new Error('You are not authorized to export these records')
      await database
        .from('pupitre_exports')
        .where('id', payload.id)
        .update({ status: 'processing', updated_at: DateTime.now().toSQL() })
      const chunks: Uint8Array[] = []
      const config = (await app.container.make('pupitre.config')) as PupitreConfig
      const maxRows = config.exports?.maxAsyncRows ?? 100_000
      let wroteHeader = false
      const result = await processExport(
        ctx,
        resource,
        action,
        table,
        payload.columns,
        payload.queryOptions,
        async (rows, processed, total) => {
          if (total > maxRows) throw new Error('The export exceeds the asynchronous row limit')
          if (rows.length > 0) {
            const stream = createCsvStream(rows, payload.columns, !wroteHeader)
            for await (const chunk of stream) chunks.push(Buffer.from(chunk))
            wroteHeader = true
          }
          await database.from('pupitre_exports').where('id', payload.id).update({
            total_rows: total,
            processed_rows: processed,
            updated_at: DateTime.now().toSQL(),
          })
        }
      )
      if (!wroteHeader) {
        for await (const chunk of createCsvStream([], payload.columns))
          chunks.push(Buffer.from(chunk))
      }
      await createPupitreStorage().put(payload.fileKey, Buffer.concat(chunks), {
        contentType: 'text/csv; charset=utf-8',
        visibility: 'private',
      })
      await database.from('pupitre_exports').where('id', payload.id).update({
        status: 'done',
        total_rows: result.total,
        processed_rows: result.total,
        file_key: payload.fileKey,
        updated_at: DateTime.now().toSQL(),
      })
    } catch (error) {
      await database
        .from('pupitre_exports')
        .where('id', payload.id)
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Export failed',
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
