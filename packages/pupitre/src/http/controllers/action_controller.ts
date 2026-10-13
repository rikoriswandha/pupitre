import { startImpersonation } from '../../auth/impersonation.js'
import { t } from '../../i18n.js'
import { publishResourceChange } from '../../realtime.js'
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
import { currentPageUrl } from '../return_url.js'
import type { ResourceRuntime } from '../../manager.js'
import type PupitreManager from '../../manager.js'
import type { ActionDefinition } from '../../definition/action.js'
import type { SchemaNodeDefinition } from '../../definition/schema.js'
import { walkSchema } from '../../definition/walk.js'
import { E_PUPITRE_FORBIDDEN, E_PUPITRE_NOT_FOUND } from '../../errors.js'
import { requestResource, scopedQuery } from '../../query/scoped_query.js'
import { consumeActionLimit } from '../../drivers/limiter.js'
import type { JobsAdapter } from '../../adapters/jobs.js'
import { fillTenantOwnership } from '../../tenancy/runtime.js'
import { resourceAttributes, syncRelationshipRepeaters } from '../repeater_relationships.js'
import { lookupOrNull } from '../../query/record_lookup.js'
import { consumeFormUploads } from '../../storage/upload_tracking.js'
import { compileValidator } from '../../compiler/vine_compiler.js'

function isJsonRequest(ctx: HttpContext): boolean {
  return isPupitreActionRequest(ctx) || ctx.request.accepts(['json', 'html']) === 'json'
}

async function getResource(ctx: HttpContext): Promise<ResourceRuntime | undefined> {
  const resource = requestResource(ctx, ctx.params.slug)
  if (!resource?.parent) return resource
  const parentResource = requestResource(ctx, resource.parent.resource)
  if (!parentResource) return undefined
  await ensureAuthorized(ctx, parentResource, 'viewAny')
  const parentId = ctx.params[resource.parent.param]
  const parent = await lookupOrNull(() =>
    scopedQuery(ctx, parentResource).where(modelKey(parentResource.model), parentId).first()
  )
  if (!parent) return undefined
  await ensureAuthorized(ctx, parentResource, 'view', parent)
  return resource
}

async function ensureNestedParentUpdate(ctx: HttpContext, resource: ResourceRuntime) {
  if (!resource.parent) return
  const parentResource = requestResource(ctx, resource.parent.resource)
  if (!parentResource) throw new E_PUPITRE_NOT_FOUND()
  const parentId = ctx.params[resource.parent.param]
  const parent = await lookupOrNull(() =>
    scopedQuery(ctx, parentResource).where(modelKey(parentResource.model), parentId).first()
  )
  if (!parent) throw new E_PUPITRE_NOT_FOUND()
  await ensureAuthorized(ctx, parentResource, 'update', parent)
}
function modelKey(model: LucidModel): string {
  return (model as LucidModel & { primaryKey?: string }).primaryKey ?? 'id'
}

function findFormAction(nodes: SchemaNodeDefinition[], name: string): ActionDefinition | undefined {
  let result: ActionDefinition | undefined
  walkSchema(nodes, (node) => {
    if (result || !('name' in node)) return
    for (const key of ['prefixAction', 'suffixAction', 'hintAction'] as const) {
      const action = (node as unknown as Record<string, unknown>)[key] as
        ActionDefinition | undefined
      if (action?.name === name) {
        result = action
        return
      }
    }
  })
  return result
}
function simpleResourceModalAction(
  resource: ResourceRuntime,
  kind: 'create' | 'edit'
): ActionDefinition {
  const form = (resource.definition.form ?? []) as unknown as SchemaNodeDefinition[]
  const base: ActionDefinition = {
    name: kind,
    kind,
    builtin: kind,
    context: kind === 'create' ? 'header' : 'record',
    form,
    modal: { submitLabel: kind === 'create' ? t('Create') : t('Save') },
    after: ({ refresh }: { refresh: { table(): void } }) => refresh.table(),
  }
  if (kind === 'create') {
    return {
      ...base,
      async handle({ data, ctx }) {
        if (!ctx) throw new E_PUPITRE_FORBIDDEN()
        const validated = (data ?? {}) as Record<string, unknown>
        await resource.model.transaction(async (trx) => {
          let values =
            (await resource.definition.hooks.mutateBeforeCreate?.(validated, ctx, trx)) ?? validated
          values =
            (await resource.definition.hooks.mutateBeforeSave?.(values, null, ctx, trx)) ?? values
          await resource.definition.hooks.beforeCreate?.(values, ctx, trx)
          await resource.definition.hooks.beforeSave?.(null, values, ctx, trx)
          values = fillTenantOwnership(ctx, resource, values)
          const attributes = resourceAttributes(resource.definition.form ?? [], values)
          const record = resource.definition.handlers.create
            ? await resource.definition.handlers.create(attributes, ctx, trx)
            : await resource.model.create(attributes, { client: trx })
          ;(record as LucidRow).useTransaction(trx)
          await syncRelationshipRepeaters(resource, record as LucidRow, values, trx)
          await resource.definition.hooks.afterCreate?.(record as never, ctx, trx)
          await resource.definition.hooks.afterSave?.(record as never, ctx, trx)
        })
      },
    }
  }
  return {
    ...base,
    fillForm: ({ record }) =>
      record && typeof record === 'object' && 'serialize' in record
        ? ((record as LucidRow).serialize() as Record<string, unknown>)
        : {},
    async handle({ data, record, ctx }) {
      if (!ctx || !record || typeof record !== 'object' || !('merge' in record))
        throw new E_PUPITRE_FORBIDDEN()
      const row = record as LucidRow
      const validated = (data ?? {}) as Record<string, unknown>
      await resource.model.transaction(async (trx) => {
        row.useTransaction(trx)
        const values =
          (await resource.definition.hooks.mutateBeforeSave?.(validated, row as never, ctx, trx)) ??
          validated
        await resource.definition.hooks.beforeSave?.(row as never, values, ctx, trx)
        if (resource.definition.handlers.update) {
          await resource.definition.handlers.update(row as never, values, ctx, trx)
        } else {
          row.merge(values as never)
          await row.save()
        }
        await resource.definition.hooks.afterSave?.(row as never, ctx, trx)
      })
    },
  }
}
function findAction(
  resource: ResourceRuntime,
  name: string,
  row: boolean
): { action: ActionDefinition; field: boolean } | undefined {
  const actions = resource.definition.actions
  const groups = row ? [actions?.row] : [actions?.header, actions?.bulk]
  const findNested = (group?: readonly ActionDefinition[]): ActionDefinition | undefined => {
    for (const candidate of group ?? []) {
      if (candidate.name === name) return candidate
      const nested = findNested(candidate.modal?.footerActions)
      if (nested) return nested
    }
    return undefined
  }
  for (const group of groups) {
    const action = findNested(group)
    if (action) return { action, field: false }
  }
  if (row) {
    const headerAction = findNested(actions?.header)
    if (headerAction?.builtin === 'impersonate') return { action: headerAction, field: false }
  }
  if (resource.definition.pages.list?.modals) {
    if (name === 'create' && !row)
      return { action: simpleResourceModalAction(resource, 'create'), field: false }
    if (name === 'edit' && row)
      return { action: simpleResourceModalAction(resource, 'edit'), field: false }
  }
  const action = findFormAction(resource.definition.form ?? [], name)
  return action ? { action, field: true } : undefined
}
async function scopedRecord(
  ctx: HttpContext,
  resource: ResourceRuntime,
  trashed = false,
  recordId: unknown = ctx.params.id
): Promise<LucidRow | null> {
  if (typeof recordId !== 'string' && typeof recordId !== 'number') return null
  return lookupOrNull(() =>
    scopedQuery(ctx, resource, trashed ? { trashed: 'only' } : {})
      .where(modelKey(resource.model), recordId)
      .first()
  )
}
async function scopedRecords(
  ctx: HttpContext,
  resource: ResourceRuntime,
  ids: unknown,
  trashed = false
): Promise<LucidRow[] | null> {
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.some((id) => typeof id !== 'string' && typeof id !== 'number')
  )
    return null
  const records = await lookupOrNull(() =>
    scopedQuery(ctx, resource, trashed ? { trashed: 'only' } : {}).whereIn(
      modelKey(resource.model),
      ids as (string | number)[]
    )
  )
  return records?.length === ids.length ? records : null
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
    if (!resource) return errorJson(ctx, t('Resource not found'), 404)
    const row = ctx.params.id !== undefined
    const recordId = ctx.params.id ?? ctx.request.input('record')
    const resolved =
      findAction(resource, ctx.params.action, row) ??
      (!row && recordId !== undefined ? findAction(resource, ctx.params.action, true) : undefined)
    if (!resolved) return errorJson(ctx, t('Action not found'), 404)
    const { action, field: fieldAction } = resolved
    if (resource.parent && action.builtin !== 'view') await ensureNestedParentUpdate(ctx, resource)
    let record: LucidRow | undefined
    await ensureAuthorized(
      ctx,
      resource,
      recordId === undefined && fieldAction ? 'create' : 'viewAny'
    )
    if (recordId !== undefined) {
      record = (await scopedRecord(ctx, resource, false, recordId)) ?? undefined
      if (!record) return errorJson(ctx, t('Record not found'), 404)
      const recordAbility = action.builtin === 'edit' ? 'update' : 'view'
      if (!(await authorizeResource(ctx, resource, recordAbility, record)))
        throw new E_PUPITRE_FORBIDDEN()
      if (
        action.builtin === 'replicate' &&
        !(await authorizeResource(ctx, resource, 'replicate', record))
      )
        throw new E_PUPITRE_FORBIDDEN()
    }
    const routes = resource.definition.pages.list?.modals
      ? {
          ...resource.urls,
          create: resource.urls.actions('create'),
          edit: (id: string | number) => resource.urls.actions('edit', id),
        }
      : resource.urls
    const effectiveAction =
      fieldAction && !record ? { ...action, context: 'header' as const } : action
    const descriptor = await compileActionDescriptor(effectiveAction, {
      baseUrl: resource.urls.list,
      ...(record
        ? { record, recordKey: record.$attributes[modelKey(resource.model)] as string | number }
        : {}),
      ctx,
      authorize: (ability, target) => authorizeResource(ctx, resource, ability, target),
      routes,
    })
    if (!descriptor.enabled)
      return errorJson(ctx, t('You are not authorized to perform this action'), 403)
    if (!action.form) return errorJson(ctx, t('This action does not define a form'), 404)
    const response = await compileActionForm(action, {
      ...fileCompileContext(ctx, record),
      url: descriptor.url,
    })
    return ctx.response.json(response)
  }

  async run(ctx: HttpContext) {
    const resource = await getResource(ctx)
    if (!resource) return errorJson(ctx, t('Resource not found'), 404)
    const row = ctx.params.id !== undefined
    const recordId = ctx.params.id ?? ctx.request.input('record')
    const resolved =
      findAction(resource, ctx.params.action, row) ??
      (!row && recordId !== undefined ? findAction(resource, ctx.params.action, true) : undefined)
    if (!resolved) return errorJson(ctx, t('Action not found'), 404)
    const { action, field: fieldAction } = resolved
    if (resource.parent && action.builtin !== 'view') await ensureNestedParentUpdate(ctx, resource)
    let record: LucidRow | undefined
    let records: LucidRow[] | undefined
    const trashedAction = action.builtin === 'restore' || action.builtin === 'forceDelete'
    if (recordId !== undefined) {
      await ensureAuthorized(ctx, resource, 'viewAny')
      record = (await scopedRecord(ctx, resource, trashedAction, recordId)) ?? undefined
      if (!record) return errorJson(ctx, t('Record not found'), 404)
      const recordAbility =
        action.builtin === 'edit'
          ? 'update'
          : action.builtin === 'delete'
            ? 'delete'
            : action.builtin === 'restore'
              ? 'restore'
              : action.builtin === 'forceDelete'
                ? 'forceDelete'
                : action.builtin === 'replicate'
                  ? 'replicate'
                  : 'view'
      if (!(await authorizeResource(ctx, resource, recordAbility, record)))
        throw new E_PUPITRE_FORBIDDEN()
      if (
        action.builtin === 'replicate' &&
        !(await authorizeResource(ctx, resource, 'view', record))
      )
        throw new E_PUPITRE_FORBIDDEN()
    } else if (
      action.context === 'bulk' ||
      action.builtin === 'bulk' ||
      Array.isArray(ctx.request.input('ids'))
    ) {
      records =
        (await scopedRecords(ctx, resource, ctx.request.input('ids'), trashedAction)) ?? undefined
      if (!records) return errorJson(ctx, t('One or more records were not found'), 404)
      await ensureAuthorized(ctx, resource, 'viewAny')
    } else {
      await ensureAuthorized(ctx, resource, fieldAction ? 'create' : 'viewAny')
    }
    if (action.rateLimit) {
      const pupitre = (
        ctx as HttpContext & {
          pupitre?: { panel?: { id?: string }; authUser?: LucidRow }
        }
      ).pupitre
      const userId = pupitre?.authUser?.$primaryKeyValue
      const subject = action.rateLimit.by === 'ip' ? ctx.request.ip() : (userId ?? ctx.request.ip())
      const key = `pupitre:action:${pupitre?.panel?.id ?? 'panel'}:${action.name}:${subject}`
      const limit = await consumeActionLimit(key, action.rateLimit)
      if (limit.limited) {
        const message = t('Too many attempts. Please try again later.')
        if (!isJsonRequest(ctx)) setPupitreFlash(ctx, [{ type: 'error', title: message }])
        return ctx.response.status(429).json({
          message,
          retryAfter: limit.retryAfter ?? 60,
        })
      }
    }
    if (action.builtin === 'impersonate') {
      if (!record || fieldAction || action.context === 'bulk') throw new E_PUPITRE_FORBIDDEN()
      if (action.can) await ensureAuthorized(ctx, resource, action.can, record)
      if (action.visible && !action.visible({ ctx, record })) throw new E_PUPITRE_FORBIDDEN()
      const result = await startImpersonation(ctx, resource, record)
      return isJsonRequest(ctx) ? actionJson(ctx, result) : ctx.response.redirect(result.redirect)
    }
    try {
      if (action.async && action.context === 'bulk') {
        const manager = (await ctx.containerResolver.make('pupitre.manager')) as PupitreManager
        const jobs = manager.jobs
        if (jobs) return await this.runAsyncBulk(ctx, resource, action, records ?? [], jobs)
      }
      const recordAction =
        action.builtin === 'restore' ||
        action.builtin === 'forceDelete' ||
        action.builtin === 'replicate'
      const bulkDelete =
        action.context === 'bulk' &&
        (action.builtin === 'delete' ||
          (action.builtin === 'bulk' &&
            (action.name === 'delete' || action.name === 'bulk-delete')))
      const result =
        recordAction || (action.context === 'bulk' && trashedAction)
          ? await this.runSoftDeleteAction(ctx, resource, action, record, records)
          : bulkDelete
            ? await this.runBulkDelete(ctx, resource, action, records ?? [])
            : await executeAction(action, {
                ctx,
                ...(record ? { record } : {}),
                ...(records ? { records } : {}),
                data: ctx.request.input('data') ?? {},
                beforeHandle: action.form
                  ? (data) => consumeFormUploads(ctx, resource.slug, [...action.form!], data)
                  : undefined,
                authorize: (ability, target) => authorizeResource(ctx, resource, ability, target),
                currentUrl: currentPageUrl(ctx, resource.urls.list),
                listUrl: resource.urls.list,
              })
      if (
        action.handle ||
        ['restore', 'forceDelete', 'replicate'].includes(action.builtin ?? '') ||
        bulkDelete
      )
        await publishResourceChange(ctx, resource.slug)
      if (result.flash.length && !isJsonRequest(ctx)) setPupitreFlash(ctx, result.flash)
      if (isPupitreActionRequest(ctx) || ctx.request.accepts(['json', 'html']) === 'json')
        return actionJson(ctx, result)
      if (result.redirect) return ctx.response.redirect(result.redirect)
      return ctx.response.redirect().back()
    } catch (error) {
      if ((error as { status?: number })?.status === 422) {
        const messages =
          (error as { messages?: { field?: string; message: string }[] }).messages ?? []
        const errors: Record<string, string[]> = {}
        for (const message of messages) {
          const field = message.field ?? '_form'
          ;(errors[field] ??= []).push(message.message)
        }
        return errorJson(ctx, t('The submitted data is invalid'), 422, errors)
      }
      throw error
    }
  }
  private async runAsyncBulk(
    ctx: HttpContext,
    resource: ResourceRuntime,
    action: ActionDefinition,
    records: LucidRow[],
    jobs: JobsAdapter
  ) {
    const userId = ctx.pupitre.user?.id
    if (userId === undefined)
      return errorJson(ctx, t('Authentication is required for queued actions'), 401)
    const tenantId = ctx.pupitre.tenant?.id ?? null
    const bulkDelete =
      action.builtin === 'delete' ||
      (action.builtin === 'bulk' && (action.name === 'delete' || action.name === 'bulk-delete'))
    const recordAbility = action.can ?? (bulkDelete ? 'delete' : undefined)
    if (action.visible && !(await action.visible({ record: records[0] ?? null, ctx })))
      throw new E_PUPITRE_FORBIDDEN()
    if (recordAbility) {
      for (const target of records) {
        if (!(await authorizeResource(ctx, resource, recordAbility, target)))
          throw new E_PUPITRE_FORBIDDEN()
      }
    }
    const submitted = ctx.request.input('data') ?? {}
    if (action.form) {
      const validated = await compileValidator([...action.form]).validate(submitted, {
        // Same meta as the bulk worker's executeAction, which validates without a record.
        record: null,
        ctx,
        timezone: ctx.pupitre.timezone ?? 'UTC',
      })
      await consumeFormUploads(ctx, resource.slug, [...action.form], validated)
    }
    const ids = records.map((record) => record.$primaryKeyValue as string | number)
    await jobs.dispatch('pupitre.bulk', {
      panelId: ctx.pupitre.panel.id,
      locale: ctx.pupitre.locale,
      resource: resource.slug,
      action: action.name,
      ids,
      userId,
      tenantId,
      data: submitted,
      params: ctx.params,
      query: ctx.request.qs(),
      headers: {
        ...(ctx.request.header('x-relations-tenant')
          ? { 'x-relations-tenant': ctx.request.header('x-relations-tenant')! }
          : {}),
      },
      currentUrl: currentPageUrl(ctx, resource.urls.list),
    })
    const result = {
      flash: [
        {
          type: 'success' as const,
          title: t('Queued {label}', { label: action.label ?? action.name }),
        },
      ],
      redirect: currentPageUrl(ctx, resource.urls.list),
      ...(action.deselectAfter ? { deselect: true } : {}),
    }
    if (result.flash.length && !isJsonRequest(ctx)) setPupitreFlash(ctx, result.flash)
    if (isPupitreActionRequest(ctx) || ctx.request.accepts(['json', 'html']) === 'json')
      return actionJson(ctx, result)
    return ctx.response.redirect(result.redirect)
  }
  private async runSoftDeleteAction(
    ctx: HttpContext,
    resource: ResourceRuntime,
    action: ActionDefinition,
    record?: LucidRow,
    records?: LucidRow[]
  ) {
    const targets = records ?? (record ? [record] : [])
    const ability =
      action.can ??
      (action.builtin === 'restore'
        ? 'restore'
        : action.builtin === 'forceDelete'
          ? 'forceDelete'
          : 'replicate')
    for (const target of targets) {
      if (!(await authorizeResource(ctx, resource, ability, target)))
        throw new E_PUPITRE_FORBIDDEN()
    }
    if (action.builtin === 'forceDelete') {
      await executeBuiltinDelete(resource.definition, targets, ctx, true)
    } else if (action.builtin === 'restore') {
      const column = resource.definition.softDeletes
      if (!column) throw new Error('Soft deletes are not enabled for this resource')
      await resource.model.transaction(async (trx) => {
        for (const target of targets) {
          target.useTransaction(trx)
          target.merge({ [column]: null })
          await target.save()
        }
      })
    } else if (action.builtin === 'replicate' && record) {
      const model = record.constructor as LucidModel
      const attributes = { ...record.$attributes }
      delete attributes[modelKey(resource.model)]
      delete attributes.createdAt
      delete attributes.updatedAt
      if (resource.definition.softDeletes) delete attributes[resource.definition.softDeletes]
      for (const attribute of action.excludeAttributes ?? []) delete attributes[attribute]
      const copy = await model.create(attributes)
      const id = copy.$attributes[modelKey(resource.model)] as string | number
      return {
        flash: [
          { type: 'success' as const, title: t('Replicated {label}', { label: resource.label }) },
        ],
        redirect: resource.urls.edit(id),
      }
    }
    return {
      flash: [
        {
          type: 'success' as const,
          title: t('{label} completed', { label: action.label ?? action.name }),
        },
      ],
      redirect: resource.urls.list,
      deselect: action.context === 'bulk',
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
        {
          type: 'success' as const,
          title: t('Deleted {count} {label}', {
            count: records.length,
            label: resource.pluralLabel,
          }),
        },
      ],
      redirect: resource.urls.list,
      deselect: true,
    }
  }
}
