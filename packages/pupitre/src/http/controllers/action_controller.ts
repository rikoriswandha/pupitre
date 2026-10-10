import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import {
  compileActionDescriptor,
  compileActionForm,
  executeAction,
  executeBuiltinDelete,
} from '../../compiler/action_compiler.js'
import { authorizeResource, ensureAuthorized } from '../../authz/bouncer.js'
import { isPupitreActionRequest, actionJson, errorJson, setPupitreFlash } from '../responses.js'
import type { ResourceRuntime } from '../../manager.js'
import type { ActionDefinition } from '../../definition/action.js'
import { E_PUPITRE_FORBIDDEN } from '../../errors.js'

async function getResource(ctx: HttpContext): Promise<ResourceRuntime | undefined> {
  const manager = (await ctx.containerResolver.make('pupitre.manager')) as {
    findResource(panelId: string, slug: string): ResourceRuntime | undefined
  }
  return manager.findResource(ctx.pupitre.panel.id, ctx.params.slug)
}

function modelKey(model: LucidModel): string {
  return (model as LucidModel & { primaryKey?: string }).primaryKey ?? 'id'
}

function findAction(
  resource: ResourceRuntime,
  name: string,
  row: boolean
): ActionDefinition | undefined {
  const actions = resource.definition.actions
  const groups = row ? [actions?.row] : [actions?.header, actions?.bulk]
  for (const group of groups) {
    const action = group?.find((candidate) => candidate.name === name)
    if (action) return action
  }
  return undefined
}

async function scopedRecord(ctx: HttpContext, resource: ResourceRuntime): Promise<LucidRow | null> {
  const query = resource.model.query()
  resource.definition.scope?.(query, ctx)
  return query.where(modelKey(resource.model), ctx.params.id).first()
}

async function scopedRecords(
  ctx: HttpContext,
  resource: ResourceRuntime,
  ids: unknown
): Promise<LucidRow[] | null> {
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.some((id) => typeof id !== 'string' && typeof id !== 'number')
  )
    return null
  const query = resource.model.query()
  resource.definition.scope?.(query, ctx)
  const records = await query.whereIn(modelKey(resource.model), ids as (string | number)[])
  return records.length === ids.length ? records : null
}

function fileCompileContext(ctx: HttpContext, record?: LucidRow) {
  return {
    ctx,
    locale: ctx.pupitre.locale,
    timezone: ctx.pupitre.timezone,
    ...(record
      ? { model: record, record: record.serialize() as unknown as Record<string, unknown> }
      : {}),
    uploadUrls: {
      upload: `${ctx.pupitre.panel.path}/_pupitre/upload`,
      delete: `${ctx.pupitre.panel.path}/_pupitre/upload`,
    },
  }
}

export default class ActionController {
  async show(ctx: HttpContext) {
    const resource = await getResource(ctx)
    if (!resource) return errorJson(ctx, 'Resource not found', 404)
    const row = ctx.params.id !== undefined
    const action = findAction(resource, ctx.params.action, row)
    if (!action) return errorJson(ctx, 'Action not found', 404)
    let record: LucidRow | undefined
    if (row) {
      await ensureAuthorized(ctx, resource, 'viewAny')
      record = (await scopedRecord(ctx, resource)) ?? undefined
      if (!record) return errorJson(ctx, 'Record not found', 404)
    } else {
      await ensureAuthorized(ctx, resource, 'viewAny')
    }
    const descriptor = await compileActionDescriptor(action, {
      baseUrl: resource.urls.list,
      ...(record
        ? { record, recordKey: record.$attributes[modelKey(resource.model)] as string | number }
        : {}),
      ctx,
      authorize: (ability, target) => authorizeResource(ctx, resource, ability, target),
      routes: resource.urls,
    })
    if (!descriptor.enabled)
      return errorJson(ctx, 'You are not authorized to perform this action', 403)
    if (!action.form) return errorJson(ctx, 'This action does not define a form', 404)
    const response = await compileActionForm(action, {
      ...fileCompileContext(ctx, record),
      url: descriptor.url,
    })
    return ctx.response.json(response)
  }

  async run(ctx: HttpContext) {
    const resource = await getResource(ctx)
    if (!resource) return errorJson(ctx, 'Resource not found', 404)
    const row = ctx.params.id !== undefined
    const action = findAction(resource, ctx.params.action, row)
    if (!action) return errorJson(ctx, 'Action not found', 404)
    let record: LucidRow | undefined
    let records: LucidRow[] | undefined
    if (row) {
      await ensureAuthorized(ctx, resource, 'viewAny')
      record = (await scopedRecord(ctx, resource)) ?? undefined
      if (!record) return errorJson(ctx, 'Record not found', 404)
    } else if (action.context === 'bulk' || action.builtin === 'bulk') {
      records = (await scopedRecords(ctx, resource, ctx.request.input('ids'))) ?? undefined
      if (!records) return errorJson(ctx, 'One or more records were not found', 404)
      await ensureAuthorized(ctx, resource, 'viewAny')
    }
    try {
      const bulkDelete =
        action.context === 'bulk' &&
        (action.builtin === 'delete' ||
          (action.builtin === 'bulk' &&
            (action.name === 'delete' || action.name === 'bulk-delete')))
      const result = bulkDelete
        ? await this.runBulkDelete(ctx, resource, action, records ?? [])
        : await executeAction(action, {
            ctx,
            ...(record ? { record } : {}),
            ...(records ? { records } : {}),
            data: ctx.request.input('data') ?? {},
            authorize: (ability, target) => authorizeResource(ctx, resource, ability, target),
            currentUrl: ctx.request.url(true),
            listUrl: resource.urls.list,
          })
      if (result.flash.length) setPupitreFlash(ctx, result.flash)
      if (isPupitreActionRequest(ctx) || ctx.request.accepts(['json', 'html']) === 'json')
        return actionJson(ctx, result)
      if (result.redirect) return ctx.response.redirect(result.redirect)
      return ctx.response.redirect().back()
    } catch (error) {
      if (
        error instanceof E_PUPITRE_FORBIDDEN ||
        (error as { code?: string })?.code === 'E_PUPITRE_FORBIDDEN'
      )
        return errorJson(ctx, 'You are not authorized to perform this action', 403)
      if ((error as { status?: number })?.status === 422) {
        const messages =
          (error as { messages?: { field?: string; message: string }[] }).messages ?? []
        const errors: Record<string, string[]> = {}
        for (const message of messages) {
          const field = message.field ?? '_form'
          ;(errors[field] ??= []).push(message.message)
        }
        return errorJson(ctx, 'The submitted data is invalid', 422, errors)
      }
      throw error
    }
  }

  private async runBulkDelete(
    ctx: HttpContext,
    resource: ResourceRuntime,
    action: ActionDefinition,
    records: LucidRow[]
  ) {
    const ability = action.can ?? 'delete'
    for (const record of records) {
      if (!(await authorizeResource(ctx, resource, ability, record)))
        throw new E_PUPITRE_FORBIDDEN()
    }
    if (action.visible && !(await action.visible({ record: records[0] ?? null, ctx })))
      throw new E_PUPITRE_FORBIDDEN()
    await executeBuiltinDelete(resource.definition, records, ctx)
    return {
      flash: [
        { type: 'success' as const, title: `Deleted ${records.length} ${resource.pluralLabel}` },
      ],
      redirect: resource.urls.list,
      deselect: true,
    }
  }
}
