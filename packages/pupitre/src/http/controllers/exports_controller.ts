import { restoreTranslation } from '../../i18n.js'
import { t } from '../../i18n.js'
import type { HttpContext } from '@adonisjs/core/http'
import type { Database } from '@adonisjs/lucid/database'
import app from '@adonisjs/core/services/app'
import { authorizeResource } from '../../authz/bouncer.js'
import { createPupitreStorage } from '../../storage/index.js'
import { importResultResponse } from '../../../catalog/wire.js'
import { errorJson } from '../responses.js'

type ExportRow = {
  id: string
  user_id: string | number
  tenant_id: string | number | null
  resource: string
  status: 'queued' | 'processing' | 'done' | 'failed'
  total_rows: number
  processed_rows: number
  file_key: string | null
  error: string | null
  result: string | null
}

async function ownedExport(ctx: HttpContext): Promise<ExportRow | null> {
  const database = (await app.container.make('lucid.db')) as Database
  const userId = ctx.pupitre.user?.id
  if (userId === undefined) return null
  const tenantId = ctx.pupitre.tenant?.id ?? null
  const query = database.from('pupitre_exports').where('id', ctx.params.id).where('user_id', userId)
  if (tenantId === null) query.whereNull('tenant_id')
  else query.where('tenant_id', tenantId)
  return (await query.first()) as ExportRow | null
}

async function authorizedResource(ctx: HttpContext, slug: string) {
  const importAction = slug.startsWith('imports:')
  const importFailure = slug.startsWith('import-failures:')
  const prefix = importFailure ? 'import-failures:' : importAction ? 'imports:' : ''
  const resourceSlug = prefix ? slug.slice(prefix.length) : slug
  const resource = ctx.pupitre.panel.resources.find((item) => item.slug === resourceSlug)
  if (!resource) return undefined
  const ability = prefix ? 'create' : 'viewAny'
  if (!(await authorizeResource(ctx, resource, ability))) return null
  return resource
}

async function authorizedExportAction(ctx: HttpContext, row: ExportRow) {
  if (row.resource.startsWith('imports:') || row.resource.startsWith('import-failures:'))
    return true
  let name: unknown
  try {
    name = row.result ? JSON.parse(row.result)?.action : undefined
  } catch {
    return false
  }
  if (typeof name !== 'string') return false
  const resource = ctx.pupitre.panel.resources.find((item) => item.slug === row.resource)
  if (!resource) return false
  const action = [
    ...(resource.definition.actions?.header ?? []),
    ...(resource.definition.actions?.bulk ?? []),
  ].find((item) => item.name === name && item.builtin === 'export')
  return !!action && (!action.can || (await authorizeResource(ctx, resource, action.can)))
}
function importResult(row: ExportRow) {
  if (!row.result) return undefined
  try {
    const parsed = importResultResponse.safeParse(JSON.parse(row.result))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

export default class ExportsController {
  async progress(ctx: HttpContext) {
    const row = await ownedExport(ctx)
    if (!row) return errorJson(ctx, t('Export not found'), 404)
    const resource = await authorizedResource(ctx, row.resource)
    if (!resource) return errorJson(ctx, t('Export not found'), 404)
    if (!(await authorizedExportAction(ctx, row)))
      return errorJson(ctx, t('You are not authorized to export these records'), 403)
    const result = importResult(row)
    let error = row.error
    if (error && row.result) {
      try {
        const metadata: unknown = JSON.parse(row.result)
        if (metadata && typeof metadata === 'object' && '_pupitreError' in metadata)
          error = restoreTranslation(error, metadata._pupitreError)
      } catch {}
    }
    return ctx.response.json({
      id: row.id,
      status: row.status,
      totalRows: row.total_rows,
      processedRows: row.processed_rows,
      ...(error ? { error } : {}),
      ...(result
        ? {
            createdRows: result.created,
            updatedRows: result.updated,
            failedRows: result.failed,
            ...(result.failedRowsUrl ? { failedRowsUrl: result.failedRowsUrl } : {}),
          }
        : {}),
      ...(row.status === 'done' && row.file_key
        ? { downloadUrl: `${ctx.pupitre.panel.path}/_pupitre/exports/${row.id}/download` }
        : {}),
    })
  }

  async download(ctx: HttpContext) {
    const row = await ownedExport(ctx)
    if (!row) return errorJson(ctx, t('Export not found'), 404)
    const resource = await authorizedResource(ctx, row.resource)
    if (!resource) return errorJson(ctx, t('Export not found'), 404)
    if (!(await authorizedExportAction(ctx, row)))
      return errorJson(ctx, t('You are not authorized to export these records'), 403)
    if (row.status !== 'done' || !row.file_key)
      return errorJson(ctx, t('Export file is not ready'), 409)
    if (!(await createPupitreStorage().exists(row.file_key)))
      return errorJson(ctx, t('Export file is no longer available'), 404)
    ctx.response.header('Content-Type', 'text/csv; charset=utf-8')
    ctx.response.header('X-Content-Type-Options', 'nosniff')
    ctx.response.header(
      'Content-Disposition',
      `attachment; filename="${resource.slug}-${row.id}.csv"`
    )
    return ctx.response.stream(await createPupitreStorage().getStream(row.file_key))
  }
}
