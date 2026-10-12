import { getMessages, requestMessages, t } from '../i18n.js'
import { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import { HttpContextFactory } from '@adonisjs/core/factories/http'
import type { Bouncer } from '@adonisjs/bouncer'
import app from '@adonisjs/core/services/app'
import type { PupitreConfig } from '../define_config.js'
import type { PanelRuntime, ResourceRuntime } from '../manager.js'
import { bindPanel, type default as PupitreManager } from '../manager.js'
import { panelGuard } from '../auth/guard.js'
import type { PupitreContext } from '../types.js'
import { E_PUPITRE_MISSING_PEER } from '../errors.js'
import { resolveTenancyAdapter } from '../tenancy/runtime.js'
import { userSummary } from '../http/middleware/pupitre_context.js'

type AuthenticatedJobContext = HttpContext & {
  auth: {
    user?: unknown
    authenticateUsing(guards: string[]): Promise<unknown>
    use(guard: string): unknown
  }
  session?: { sessionId: string; get(key: string): unknown }
}
type AuthManagerForJob = {
  defaultGuard: string
  createAuthenticator(ctx: HttpContext): AuthenticatedJobContext['auth']
}
type SessionBackedGuard = { sessionKeyName?: string }

export type PupitreJobContextPayload = {
  panelId: string
  resource: string
  userId: string | number
  tenantId: string | number | null
  locale?: string
  params?: Record<string, string | number>
  query?: Record<string, unknown>
  headers?: Record<string, string>
  data?: Record<string, unknown>
}

/**
 * Builds the request-independent context supplied to callbacks executing in jobs.
 * It intentionally has no authenticated HTTP session; callbacks may use `ctx.pupitre`,
 * `ctx.params`, `ctx.request.input/qs/header`, logger, container and Bouncer, but must
 * not depend on response/session/flash behavior.
 */
export async function createJobContext(
  manager: PupitreManager,
  payload: PupitreJobContextPayload
): Promise<{ ctx: HttpContext; resource: ResourceRuntime }> {
  const panel = manager.getPanel(payload.panelId)
  if (!panel) throw new Error(`Pupitre panel "${payload.panelId}" is not registered`)
  const resource = panel.resources.find((item) => item.slug === payload.resource)
  if (!resource) throw new Error(`Pupitre resource "${payload.resource}" is not registered`)
  const config = (await app.container.make('pupitre.config')) as PupitreConfig
  const path = panel.path
  const ctx = new HttpContextFactory()
    .merge({
      url: `${path}/${resource.routeSlug}`,
      method: 'POST',
      route: { pattern: `${path}/${resource.routeSlug}`, params: payload.params ?? {} },
      logger: await app.container.make('logger'),
    })
    .create()
  ctx.containerResolver = app.container.createResolver()
  ctx.containerResolver.bindValue(HttpContext, ctx)
  ctx.params = { ...(payload.params ?? {}) }
  const request = ctx.request as unknown as {
    input: (key: string, defaultValue?: unknown) => unknown
    header: (key: string) => string | undefined
    qs: () => Record<string, unknown>
  }
  request.input = (key, defaultValue) => payload.data?.[key] ?? defaultValue
  request.header = (key) => payload.headers?.[key.toLowerCase()]
  request.qs = () => payload.query ?? {}
  const authManager = (await app.container.make('auth.manager')) as AuthManagerForJob
  const guardName = panelGuard(panel) ?? authManager.defaultGuard
  const authenticator = authManager.createAuthenticator(ctx)
  const guard = authenticator.use(guardName) as SessionBackedGuard
  const sessionKeyName = guard.sessionKeyName
  if (!sessionKeyName)
    throw new Error(`The panel guard "${guardName}" cannot resolve queued users from an identifier`)
  Object.assign(ctx, {
    session: {
      sessionId: `pupitre-job-${String(payload.userId)}`,
      get: (key: string) => (key === sessionKeyName ? payload.userId : undefined),
    },
  })
  Object.defineProperty(ctx, 'auth', { configurable: true, value: authenticator })
  const authUser = (await authenticator.authenticateUsing([guardName])) as LucidRow
  const tenantContext = Object.assign(ctx, { pupitre: { panel, authUser } }) as HttpContext
  const tenantAdapter = await resolveTenancyAdapter(tenantContext)
  let tenant = null
  if (panel.tenancy && tenantAdapter && payload.tenantId !== null) {
    const memberships = await tenantAdapter.listForUser(tenantContext)
    const membership = memberships.find((item) => String(item.id) === String(payload.tenantId))
    if (!membership) throw new Error(t('The queued job tenant is no longer available to its owner'))
    ctx.params.tenant = membership.slug ?? String(membership.id)
    tenant = await tenantAdapter.resolve(tenantContext)
    if (!tenant || String(tenant.id) !== String(payload.tenantId))
      throw new Error(t('The queued job tenant could not be resolved'))
  }
  const boundPanel: PanelRuntime =
    tenant && panel.tenancy?.mode === 'url'
      ? bindPanel(panel, `${panel.path}/${tenant.slug ?? encodeURIComponent(String(tenant.id))}`)
      : panel
  const pupitre: PupitreContext = {
    panel: boundPanel,
    basePath: panel.path,
    locale: payload.locale ?? panel.locale ?? 'en',
    timezone: userSummary(authUser, config)?.timezone ?? panel.timezone ?? config.timezone ?? 'UTC',
    user: userSummary(authUser, config),
    authUser,
    tenant,
    tenancyAdapter: tenantAdapter ?? undefined,
  }
  Object.assign(ctx, { pupitre })
  requestMessages.set(ctx, getMessages(config, boundPanel, pupitre.locale))
  let BouncerClass: typeof Bouncer
  try {
    // Keep the optional Bouncer peer lazy so jobs without policies do not require it.
    const bouncerModule = await import('@adonisjs/bouncer')
    BouncerClass = bouncerModule.Bouncer
  } catch {
    throw new E_PUPITRE_MISSING_PEER()
  }
  const policies = config.policies ? await config.policies() : {}
  Object.assign(ctx, {
    bouncer: new BouncerClass(
      () => (ctx as AuthenticatedJobContext).auth.user as LucidRow | null,
      {},
      policies as never
    ).setContainerResolver(ctx.containerResolver),
    response: undefined,
  })
  return { ctx, resource }
}
