import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { JobsAdapter } from '../adapters/jobs.js'
import type PupitreManager from '../manager.js'
import { executeAction, executeBuiltinDelete } from '../compiler/action_compiler.js'
import { authorizeResource, ensureAuthorized } from '../authz/bouncer.js'
import { E_PUPITRE_FORBIDDEN } from '../errors.js'
import { requestResource, scopedQuery } from '../query/scoped_query.js'
import { createJobContext } from './job_context.js'
import { authorizeNestedParent } from '../http/controllers/nested_resource_guards.js'
import { publishResourceChange } from '../realtime.js'

type BulkJobPayload = {
  panelId: string
  resource: string
  action: string
  ids: Array<string | number>
  userId: string | number
  tenantId: string | number | null
  data: Record<string, unknown>
  params?: Record<string, string | number>
  query?: Record<string, unknown>
  headers?: Record<string, string>
  currentUrl?: string
}

function keyName(model: LucidModel): string {
  return (model as LucidModel & { primaryKey?: string }).primaryKey ?? 'id'
}

/** Registers the built-in bulk worker once per application/worker boot. */
export function registerBulkJob(jobs: JobsAdapter, manager: PupitreManager) {
  jobs.register('pupitre.bulk', async (rawPayload) => {
    const payload = rawPayload as unknown as BulkJobPayload
    if (!Array.isArray(payload.ids) || payload.ids.length === 0)
      throw new Error('Queued bulk action has no selected records')
    const { ctx, resource } = await createJobContext(manager, payload)
    const action = [
      ...(resource.definition.actions?.header ?? []),
      ...(resource.definition.actions?.bulk ?? []),
    ].find((item) => item.name === payload.action)
    if (!action) throw new Error('Queued bulk action is unavailable')
    const scopedResource = requestResource(ctx, resource.slug) ?? resource
    await authorizeNestedParent(ctx, scopedResource, true)
    await ensureAuthorized(ctx, scopedResource, 'viewAny')
    const records = await scopedQuery(ctx, scopedResource)
      .whereIn(keyName(resource.model), payload.ids)
      .exec()
    if (records.length !== payload.ids.length) throw new E_PUPITRE_FORBIDDEN()
    const bulkDelete =
      action.builtin === 'delete' ||
      (action.builtin === 'bulk' && (action.name === 'delete' || action.name === 'bulk-delete'))
    const ability = action.can ?? (bulkDelete ? 'delete' : undefined)
    if (ability) {
      for (const record of records) {
        if (!(await authorizeResource(ctx, scopedResource, ability, record)))
          throw new E_PUPITRE_FORBIDDEN()
      }
    }
    if (action.visible && !(await action.visible({ record: records[0] ?? null, ctx })))
      throw new E_PUPITRE_FORBIDDEN()
    if (bulkDelete) {
      await executeBuiltinDelete(resource.definition, records, ctx)
      await publishResourceChange(ctx, resource.slug)
      return
    }
    await executeAction(action, {
      ctx,
      records: records as LucidRow[],
      data: payload.data && typeof payload.data === 'object' ? payload.data : {},
      authorize: (name, target) => authorizeResource(ctx, scopedResource, name, target),
      currentUrl: payload.currentUrl ?? scopedResource.urls.list,
      listUrl: scopedResource.urls.list,
    })
    await publishResourceChange(ctx, resource.slug)
  })
}
