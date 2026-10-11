import { publishNotification } from '../realtime.js'
import type { HttpContext } from '@adonisjs/core/http'
import type { ActionDescriptor, ActionFormResponse, ActionResult } from '../../catalog/wire.js'
import type { ActionDefinition, NotificationAction } from '../definition/action.js'
import type { ResourceDefinition } from '../definition/resource.js'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { CompileContext } from './schema_compiler.js'
import { compileForm } from './schema_compiler.js'
import { compileValidator } from './vine_compiler.js'
import { E_PUPITRE_FORBIDDEN, E_PUPITRE_INVALID_ACTION_CONTEXT } from '../errors.js'
import { t } from '../i18n.js'
import { resolveAdapter } from '../define_config.js'
import type { PupitreConfig } from '../define_config.js'
import { DateTime } from 'luxon'

export type ActionAuthorize = (ability: string, record?: LucidRow) => Promise<boolean>
export type ActionRoutes = {
  list: string
  create: string
  edit(id: string | number): string
  view(id: string | number): string
  destroy(id: string | number): string
}

function getAbility(action: ActionDefinition): string | undefined {
  if (action.can) return action.can
  switch (action.builtin) {
    case 'create':
      return 'create'
    case 'edit':
      return 'update'
    case 'view':
      return 'view'
    case 'delete':
      return 'delete'
    case 'restore':
      return 'restore'
    case 'forceDelete':
      return 'forceDelete'
    case 'export':
      return 'viewAny'
    case 'import':
      return 'create'
    case 'replicate':
      return 'replicate'
    case 'attach':
      return 'attach'
    case 'detach':
      return 'detach'
    case 'associate':
      return 'associate'
    case 'dissociate':
      return 'dissociate'
    case 'bulk':
      return isBulkDelete(action) ? 'delete' : undefined
    default:
      return undefined
  }
}
function defaultLabel(action: ActionDefinition): string {
  if (action.label) return action.label
  if (isBulkDelete(action)) return t('Delete')
  if (action.builtin && action.builtin !== 'bulk') {
    return t(action.builtin[0]!.toUpperCase() + action.builtin.slice(1))
  }
  return action.name
}

function recordLabel(record?: LucidRow): string {
  if (!record) return 'record'
  const constructorName = record.constructor.name
  return constructorName.replace(/([a-z])([A-Z])/g, '$1 $2')
}

function isBulkDelete(action: ActionDefinition): boolean {
  return action.builtin === 'bulk' && (action.name === 'delete' || action.name === 'bulk-delete')
}

export async function compileActionDescriptor(
  action: ActionDefinition,
  options: {
    baseUrl: string
    record?: LucidRow
    recordKey?: string | number
    ctx: HttpContext
    authorize(ability: string, record?: LucidRow): Promise<boolean>
    routes: ActionRoutes
    resourceLabel?: string
  }
): Promise<ActionDescriptor> {
  if (action.async && action.context !== 'bulk' && action.builtin !== 'import')
    throw new E_PUPITRE_INVALID_ACTION_CONTEXT()
  const { record, ctx } = options
  const ability = getAbility(action)
  const visible = action.visible ? action.visible({ record: record ?? null, ctx }) : true
  const resourceAbility =
    action.builtin === 'export' ? 'viewAny' : action.builtin === 'import' ? 'create' : undefined
  const resourceAuthorized =
    resourceAbility && action.can ? await options.authorize(resourceAbility, record) : true
  const authorized =
    resourceAuthorized && (ability ? await options.authorize(ability, record) : true)
  const enabled = visible && authorized
  let kind: ActionDescriptor['kind']
  if (action.url) kind = 'link'
  else if ((action.builtin === 'create' || action.builtin === 'edit') && action.form) kind = 'form'
  else if (action.builtin === 'create' || action.builtin === 'edit' || action.builtin === 'view')
    kind = 'link'
  else if (action.builtin === 'attach' || action.builtin === 'associate') kind = 'form'
  else if (action.builtin === 'detach' || action.builtin === 'dissociate') kind = 'confirm'
  else if (action.builtin === 'export' || action.builtin === 'import') kind = 'direct'
  else if (
    action.builtin === 'restore' ||
    action.builtin === 'forceDelete' ||
    action.builtin === 'replicate'
  )
    kind = action.builtin === 'replicate' ? 'direct' : 'confirm'
  else if (action.form) kind = 'form'
  else if (action.confirmation || action.builtin === 'delete' || isBulkDelete(action))
    kind = 'confirm'
  else kind = 'direct'

  const id = options.recordKey ?? (record as (LucidRow & { id?: string | number }) | undefined)?.id
  let url: string
  if (action.url) {
    url =
      typeof action.url === 'function' ? action.url({ record: record ?? null, ctx }) : action.url
  } else if (action.builtin === 'create') {
    url = options.routes.create
  } else if (action.builtin === 'export') {
    url = `${options.baseUrl.replace(/\/$/, '')}/export?action=${encodeURIComponent(action.name)}`
  } else if (action.builtin === 'import') {
    url = `${options.baseUrl.replace(/\/$/, '')}/import?action=${encodeURIComponent(action.name)}`
  } else if (action.builtin === 'edit' || action.builtin === 'view') {
    if (id === undefined) throw new Error(`Action "${action.name}" requires a record key`)
    url = action.builtin === 'edit' ? options.routes.edit(id) : options.routes.view(id)
  } else if (
    action.builtin === 'delete' ||
    action.builtin === 'restore' ||
    action.builtin === 'forceDelete' ||
    action.builtin === 'replicate'
  ) {
    if (action.context === 'record' && id === undefined)
      throw new Error(`Action "${action.name}" requires a record key`)
    url =
      action.builtin === 'delete' && action.context === 'record'
        ? options.routes.destroy(id!)
        : action.context === 'record'
          ? `${options.baseUrl.replace(/\/$/, '')}/${encodeURIComponent(String(id))}/actions/${action.name}`
          : `${options.baseUrl.replace(/\/$/, '')}/actions/${action.name}`
  } else if (action.context === 'record') {
    if (id === undefined) throw new Error(`Action "${action.name}" requires a record key`)
    url = `${options.baseUrl.replace(/\/$/, '')}/${encodeURIComponent(String(id))}/actions/${action.name}`
  } else {
    url = `${options.baseUrl.replace(/\/$/, '')}/actions/${action.name}`
  }
  if (
    !action.url &&
    action.context === 'header' &&
    record &&
    id !== undefined &&
    (!action.builtin ||
      action.builtin === 'delete' ||
      action.builtin === 'restore' ||
      action.builtin === 'forceDelete' ||
      action.builtin === 'replicate')
  ) {
    const separator = url.includes('?') ? '&' : '?'
    url += `${separator}record=${encodeURIComponent(String(id))}`
  }
  const destructive =
    action.confirmation?.destructive ??
    (action.builtin === 'delete' || action.builtin === 'forceDelete' || isBulkDelete(action))
  const confirm =
    kind === 'confirm'
      ? {
          heading:
            action.confirmation?.heading ??
            (destructive
              ? t(`Delete ${options.resourceLabel ?? recordLabel(record)}?`)
              : defaultLabel(action)),
          ...(action.confirmation?.submitLabel
            ? { submitLabel: action.confirmation.submitLabel }
            : {}),
          ...(action.confirmation?.cancelLabel
            ? { cancelLabel: action.confirmation.cancelLabel }
            : {}),
          ...(action.confirmation?.icon ? { icon: action.confirmation.icon } : {}),
          ...(destructive
            ? { destructive: true }
            : action.confirmation?.destructive === false
              ? { destructive: false }
              : {}),
        }
      : undefined
  let modal: ActionDescriptor['modal']
  if (action.modal) {
    const { footerActions, ...modalOptions } = action.modal
    modal = {
      ...modalOptions,
      ...(footerActions
        ? {
            footerActions: await Promise.all(
              footerActions.map(async (child) => {
                const compiled = await compileActionDescriptor(
                  { ...child, context: action.context },
                  options
                )
                return {
                  name: compiled.name,
                  label: compiled.label,
                  kind: compiled.kind,
                  url: compiled.url,
                  enabled: compiled.enabled,
                  ...(compiled.method ? { method: compiled.method } : {}),
                  ...(compiled.openInNewTab ? { openInNewTab: true } : {}),
                  ...(compiled.confirm ? { confirm: compiled.confirm } : {}),
                }
              })
            ),
          }
        : {}),
    }
  }
  const descriptor: ActionDescriptor = {
    name: action.name,
    label: defaultLabel(action),
    kind,
    url,
    method:
      kind === 'link'
        ? 'get'
        : action.builtin === 'delete' && action.context === 'record'
          ? 'delete'
          : 'post',
    enabled: enabled && (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url)),
    ...(action.icon ? { icon: action.icon } : {}),
    ...(action.variant ? { variant: action.variant } : {}),
    ...(action.color ? { color: action.color } : {}),
    ...(action.openUrlInNewTab ? { openInNewTab: true } : {}),
    ...(action.keyBindings ? { keyBindings: [...action.keyBindings] } : {}),
    ...(action.group ? { group: action.group } : {}),
    ...(confirm ? { confirm } : {}),
    ...(action.deepLinkable ? { deepLink: true } : {}),
    ...(modal ? { modal } : {}),
  }
  return descriptor
}

export async function compileActionForm(
  action: ActionDefinition,
  options: CompileContext & { url: string }
): Promise<ActionFormResponse> {
  if (!action.form) throw new Error(`Action "${action.name}" does not define a form`)
  const data = action.fillForm
    ? await action.fillForm({ record: options.model ?? options.record ?? null, ctx: options.ctx })
    : undefined
  return compileForm([...action.form], {
    ...options,
    form: {
      method: 'post',
      url: options.url,
      submitLabel: action.modal?.submitLabel ?? defaultLabel(action),
      ...(action.keyBindings ? { keyBindings: [...action.keyBindings] } : {}),
      dirtyGuard: true,
    },
    ...(data ? { data } : {}),
  })
}

type FlashType = 'success' | 'error' | 'warning' | 'info'
type PendingFlash = {
  type: FlashType
  title: string
  body?: string
  actions?: NotificationAction[]
}
type ActionCallbacks = {
  redirect: { back(): void; to(url: string): void }
  refresh: { table(): void }
}

export async function executeAction(
  action: ActionDefinition,
  options: {
    ctx: HttpContext
    record?: LucidRow
    records?: LucidRow[]
    data: unknown
    authorize(ability: string, record?: LucidRow): Promise<boolean>
    currentUrl: string
    listUrl: string
  }
): Promise<ActionResult> {
  const { record, records, ctx } = options
  const ability = getAbility(action)
  const visibilityRecord = record ?? records?.[0]
  if (action.visible && !(await action.visible({ record: visibilityRecord ?? null, ctx }))) {
    throw new E_PUPITRE_FORBIDDEN()
  }
  if (ability) {
    const targets = records?.length ? records : [record]
    for (const target of targets) {
      if (!(await options.authorize(ability, target))) throw new E_PUPITRE_FORBIDDEN()
    }
  }
  const timezone =
    (ctx as HttpContext & { pupitre?: { timezone?: string } }).pupitre?.timezone ?? 'UTC'
  const data = action.form
    ? await compileValidator([...action.form]).validate(options.data, {
        record: record ?? null,
        ctx,
        timezone,
      })
    : (options.data as Record<string, unknown>)
  const flash: PendingFlash[] = []
  const notify = {
    success: (title: string) => flashBuilder('success', title, flash, ctx),
    danger: (title: string) => flashBuilder('error', title, flash, ctx),
    error: (title: string) => flashBuilder('error', title, flash, ctx),
    warning: (title: string) => flashBuilder('warning', title, flash, ctx),
    info: (title: string) => flashBuilder('info', title, flash, ctx),
  }
  const handleContext = { record, records, data, ctx, notify }
  if (action.handle) await action.handle(handleContext)

  let redirect: string | undefined = options.currentUrl
  let reload = false
  const afterContext: ActionCallbacks = {
    redirect: {
      back() {
        redirect = options.currentUrl
      },
      to(url) {
        redirect = url
      },
    },
    refresh: {
      table() {
        redirect = undefined
        reload = true
      },
    },
  }
  if (action.after) await action.after({ ...handleContext, ...afterContext })
  return {
    flash,
    ...(redirect ? { redirect } : {}),
    ...(reload ? { reload: true } : {}),
    ...(action.deselectAfter ? { deselect: true } : {}),
  }
}

function flashBuilder(type: FlashType, title: string, target: PendingFlash[], ctx: HttpContext) {
  let body: string | undefined
  let actions: NotificationAction[] | undefined
  const builder = {
    body(value: string) {
      body = value
      return builder
    },
    actions(value: readonly { definition: NotificationAction }[]) {
      actions = value.map((item) => item.definition)
      return builder
    },
    send() {
      target.push({
        type,
        title,
        ...(body !== undefined ? { body } : {}),
        ...(actions ? { actions } : {}),
      })
    },
    async sendToDatabase(user?: LucidRow) {
      const recipient = user ?? ctx.pupitre.authUser
      if (!recipient) {
        ctx.logger
          .child({ module: 'pupitre' })
          .warn('Pupitre notification skipped: no authenticated recipient or notifications adapter')
        return
      }
      const config = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
      const adapter = await resolveAdapter(config.notifications)
      if (!adapter) {
        ctx.logger
          .child({ module: 'pupitre' })
          .warn('Pupitre notification skipped: no notifications adapter is configured')
        return
      }
      await adapter.toInbox(
        recipient,
        {
          type,
          title,
          ...(body !== undefined ? { body } : {}),
          ...(actions ? { actions } : {}),
        },
        ctx
      )
      if (recipient.$primaryKeyValue !== undefined)
        await publishNotification(ctx, recipient.$primaryKeyValue)
    },
  }
  return builder
}

export async function executeBuiltinDelete<Model extends object>(
  resource: ResourceDefinition<Model>,
  records: LucidRow[],
  ctx: HttpContext,
  force = false
): Promise<void> {
  const Model = records[0]?.constructor as LucidModel | undefined
  if (!Model || records.length === 0) return
  await Model.transaction(async (trx) => {
    for (const record of records) {
      record.useTransaction(trx)
      await resource.hooks.beforeDelete?.(record as Model, ctx, trx)
      if (resource.softDeletes && !force) {
        // Through `merge` so the model's column (de)serialisers see a Luxon DateTime.
        record.merge({ [resource.softDeletes]: DateTime.now() })
        await record.save()
      } else {
        await record.delete()
      }
      await resource.hooks.afterDelete?.(record as Model, ctx, trx)
    }
  })
}
