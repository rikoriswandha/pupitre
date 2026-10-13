import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import vine from '@vinejs/vine'
import type { ResourceRuntime } from '../manager.js'
import type { PupitreConfig } from '../define_config.js'
import { resolveResourcePolicy, authorizeResource } from '../authz/bouncer.js'
import { resolveTenancyAdapter } from '../tenancy/runtime.js'
import { E_PUPITRE_FORBIDDEN } from '../errors.js'
import { currentPageUrl } from '../http/return_url.js'
import { recordAuthEvent } from './session_service.js'

export const impersonationKey = 'pupitre.impersonation'
export type ImpersonationState = {
  actorId: string | number
  targetId: string | number
  panelId: string
  guard: string
  returnPath: string
}
const emptyBody = vine.compile(vine.object({}))
export type ImpersonationEvent = {
  actorId: string | number
  targetId: string | number
  panelId: string
}
declare module '@adonisjs/core/types' {
  interface EventsList {
    'pupitre:impersonation:started': ImpersonationEvent
    'pupitre:impersonation:stopped': ImpersonationEvent
  }
}
export function impersonationState(ctx: HttpContext): ImpersonationState | undefined {
  return ctx.session?.get(impersonationKey) as ImpersonationState | undefined
}
type SessionAuthContext = Omit<HttpContext, 'auth'> & {
  auth: { use(name: string): { login(user: LucidRow): Promise<void>; logout(): Promise<void> } }
}
export function safePath(value: unknown, fallback: string): string {
  return typeof value === 'string' &&
    /^\/(?!\/)/.test(value) &&
    !/[\\\r\n]/.test(value) &&
    !value.includes(String.fromCharCode(0))
    ? value
    : fallback
}
export async function canImpersonate(
  ctx: HttpContext,
  resource: ResourceRuntime,
  target: LucidRow
): Promise<boolean> {
  const options = ctx.pupitre.panel.impersonation
  const actor = ctx.pupitre.authUser
  if (
    !options ||
    !actor ||
    !target ||
    impersonationState(ctx) ||
    ctx.session?.get('pupitre.pendingLogin')
  )
    return false
  const cfg = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
  if (!cfg.auth.model) return false
  const authModel = await cfg.auth.model()
  if (authModel.default !== resource.model) return false
  const actorAttributes = actor.$attributes as Record<string, unknown>
  if (
    ctx.pupitre.panel.auth.mfa &&
    actorAttributes[cfg.auth.columns.mfaEnabledAt] &&
    ctx.session?.get(`pupitre.mfaSatisfied.${ctx.pupitre.panel.id}`) !==
      String(actor.$primaryKeyValue)
  )
    return false
  if (options.canImpersonate) {
    if (!(await options.canImpersonate(actor, ctx))) return false
  } else {
    const policy = await resolveResourcePolicy(resource, cfg)
    if (
      !policy ||
      !('impersonate' in policy.prototype) ||
      typeof policy.prototype.impersonate !== 'function' ||
      !(await authorizeResource(ctx, resource, 'impersonate', target))
    )
      return false
  }
  if (
    options.canBeImpersonated
      ? !(await options.canBeImpersonated(target, ctx))
      : String(actor.$primaryKeyValue) === String(target.$primaryKeyValue)
  )
    return false
  const access = target as LucidRow & {
    canAccessPanel?: (panel: unknown) => boolean | Promise<boolean>
  }
  if (access.canAccessPanel && !(await access.canAccessPanel(ctx.pupitre.panel))) return false
  const adapter = await resolveTenancyAdapter(ctx)
  if (adapter && ctx.pupitre.tenant) {
    const previous = ctx.pupitre.authUser
    ctx.pupitre.authUser = target
    try {
      const memberships = await adapter.listForUser(ctx)
      if (!memberships.some((tenant) => String(tenant.id) === String(ctx.pupitre.tenant!.id)))
        return false
    } finally {
      ctx.pupitre.authUser = previous
    }
  }
  return true
}
export async function startImpersonation(
  ctx: HttpContext,
  resource: ResourceRuntime,
  target: LucidRow
) {
  // The Adonis service singleton is unavailable until the host application boots.
  const { default: emitter } = await import('@adonisjs/core/services/emitter')
  await emptyBody.validate(ctx.request.all())
  if (!(await canImpersonate(ctx, resource, target)) || !ctx.session)
    throw new E_PUPITRE_FORBIDDEN()
  const panel = ctx.pupitre.panel
  const actorId = ctx.pupitre.authUser!.$primaryKeyValue
  const targetId = target.$primaryKeyValue
  if (actorId === undefined || targetId === undefined) throw new E_PUPITRE_FORBIDDEN()
  const state: ImpersonationState = {
    actorId,
    targetId,
    panelId: panel.id,
    guard: panel.guard ?? 'web',
    returnPath: safePath(currentPageUrl(ctx, resource.urls.list), resource.urls.list),
  }
  ctx.session.put(impersonationKey, state)
  const authContext = ctx as SessionAuthContext
  await authContext.auth.use(state.guard).login(target)
  ctx.session.regenerate()
  await recordAuthEvent(ctx, {
    event: 'impersonation_started',
    userId: state.actorId,
    method: 'impersonation',
  })
  await emitter.emit('pupitre:impersonation:started', {
    actorId: state.actorId,
    targetId: state.targetId,
    panelId: state.panelId,
  })
  return { flash: [], redirect: safePath(panel.impersonation?.redirectTo, panel.path) }
}
export default class ImpersonationController {
  async leave(ctx: HttpContext) {
    // The Adonis service singleton is unavailable until the host application boots.
    const { default: emitter } = await import('@adonisjs/core/services/emitter')
    await emptyBody.validate(ctx.request.all())
    const state = impersonationState(ctx)
    if (!state || state.panelId !== ctx.pupitre.panel.id || !ctx.session)
      throw new E_PUPITRE_FORBIDDEN()
    const cfg = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
    const authModel = cfg.auth.model ? await cfg.auth.model() : undefined
    const model = authModel?.default
    const actor = model ? await model.find(state.actorId) : null
    ctx.session.forget(impersonationKey)
    const authContext = ctx as SessionAuthContext
    if (actor) await authContext.auth.use(state.guard).login(actor)
    else {
      await authContext.auth.use(state.guard).logout()
      ctx.session.clear()
    }
    ctx.session.regenerate()
    await recordAuthEvent(ctx, {
      event: 'impersonation_stopped',
      userId: state.actorId,
      method: 'impersonation',
    })
    await emitter.emit('pupitre:impersonation:stopped', {
      actorId: state.actorId,
      targetId: state.targetId,
      panelId: state.panelId,
    })
    return ctx.response.redirect(
      actor ? safePath(state.returnPath, ctx.pupitre.panel.path) : `${ctx.pupitre.basePath}/login`
    )
  }
}
