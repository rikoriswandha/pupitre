import { storedJobError } from './error.js'
import { t } from '../i18n.js'
import app from '@adonisjs/core/services/app'
import type { Database } from '@adonisjs/lucid/database'
import { parse as parseCsv } from 'csv-parse/sync'
import { DateTime } from 'luxon'
import type { JobsAdapter } from '../adapters/jobs.js'
import type PupitreManager from '../manager.js'
import { createPupitreStorage } from '../storage/index.js'
import { createJobContext } from './job_context.js'
import { actionDefinition, processImportRows } from '../http/controllers/import_controller.js'
import { authorizeNestedParent } from '../http/controllers/nested_resource_guards.js'
import { authorizeResource } from '../authz/bouncer.js'

type ImportJobPayload = {
  importId: string
  panelId: string
  resource: string
  action: string
  userId: string | number
  tenantId: string | number | null
  locale?: string
  fileKey: string
  mapping: Record<string, string>
  params?: Record<string, string | number>
  query?: Record<string, unknown>
}

/** Registers one stable import job route before the queue worker starts. */
export function registerImportJob(jobs: JobsAdapter, manager: PupitreManager) {
  jobs.register('pupitre.import', async (rawPayload) => {
    const payload = rawPayload as unknown as ImportJobPayload
    const database = (await app.container.make('lucid.db')) as Database
    try {
      const row = await database.from('pupitre_exports').where('id', payload.importId).first()
      if (
        !row ||
        String(row.user_id) !== String(payload.userId) ||
        String(row.tenant_id ?? '') !== String(payload.tenantId ?? '')
      )
        throw new Error('Queued import owner or tenant changed')
      const { ctx, resource } = await createJobContext(manager, payload)
      const action = actionDefinition(resource, payload.action)
      if (!action || action.builtin !== 'import')
        throw new Error(t('Queued import action is unavailable'))
      await authorizeNestedParent(ctx, resource, true)
      if (!(await authorizeResource(ctx, resource, 'create')))
        throw new Error(t('You are not authorized to import records'))
      if (action.can && !(await authorizeResource(ctx, resource, action.can)))
        throw new Error(t('You are not authorized to import records'))
      const stream = await createPupitreStorage().getStream(payload.fileKey)
      const chunks: Uint8Array[] = []
      for await (const chunk of stream) chunks.push(Buffer.from(chunk))
      const parsed = parseCsv(Buffer.concat(chunks), {
        bom: true,
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      }) as Record<string, string>[]
      const headers = parsed.length > 0 ? Object.keys(parsed[0]!) : []
      if (headers.length === 0) throw new Error(t('The queued CSV file has no header row'))
      await database.from('pupitre_exports').where('id', payload.importId).update({
        status: 'processing',
        total_rows: parsed.length,
        updated_at: DateTime.now().toSQL(),
      })
      const result = await processImportRows(
        ctx,
        resource,
        action,
        parsed,
        headers,
        payload.mapping,
        async (processed) => {
          await database.from('pupitre_exports').where('id', payload.importId).update({
            processed_rows: processed,
            updated_at: DateTime.now().toSQL(),
          })
        }
      )
      await database
        .from('pupitre_exports')
        .where('id', payload.importId)
        .update({
          status: 'done',
          total_rows: parsed.length,
          processed_rows: parsed.length,
          result: JSON.stringify(result),
          updated_at: DateTime.now().toSQL(),
        })
    } catch (error) {
      await database
        .from('pupitre_exports')
        .where('id', payload.importId)
        .update({
          status: 'failed',
          ...storedJobError(error, t('Import failed')),
          updated_at: DateTime.now().toSQL(),
        })
      throw error
    } finally {
      await createPupitreStorage().delete(payload.fileKey)
    }
  })
}
