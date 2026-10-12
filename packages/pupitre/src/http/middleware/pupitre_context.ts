import { createPupitreStorage } from '../../storage/index.js'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type PupitreManager from '../../manager.js'
import type { PupitreConfig } from '../../define_config.js'
import { handleUnauthenticated } from '../../auth/unauthenticated.js'
import { panelGuard } from '../../auth/guard.js'
import { bindPanel } from '../../manager.js'
import { resolveTenancyAdapter } from '../../tenancy/runtime.js'
import {
  getMessages,
  requestMessages,
  resolveLocale,
  resolveTranslations,
  stripTranslationMarkers,
} from '../../i18n.js'

type AuthContext = {
  auth?: {
    user?: LucidRow | null
    authenticateUsing(guards: string[]): Promise<LucidRow>
    checkUsing(guards: string[]): Promise<boolean>
    use(guard: string): {
      authenticate(): Promise<LucidRow>
      check(): Promise<boolean>
      user?: LucidRow
    }
  }
}

/** Serializable user summary shared with the client. */
export function userSummary(authUser: LucidRow | null, config: PupitreConfig) {
  if (!authUser) return null
  const attributes = authUser as unknown as Record<string, unknown>
  const columns = config.auth.columns
  const avatarUrl = attributes.avatarUrl
  const timezone = attributes[columns.timezone]
  return {
    id: attributes.id as string | number,
    name: String(
      attributes[columns.name] ??
        attributes.name ??
        attributes.fullName ??
        attributes[columns.email] ??
        ''
    ),
    email: String(attributes[columns.email] ?? ''),
    ...(typeof avatarUrl === 'string' ? { avatarUrl } : {}),
    ...(typeof timezone === 'string' && timezone ? { timezone } : {}),
  }
}

export default class PupitreContextMiddleware {
  constructor(private readonly options: { requireUser: boolean } = { requireUser: true }) {}

  async handle(ctx: HttpContext, next: () => Promise<void>) {
    const manager = (await ctx.containerResolver.make('pupitre.manager')) as PupitreManager
    const routeName = ctx.route?.name ?? ''
    const panelId = routeName.split('.')[0]
    const panel = manager.getPanel(panelId)
    if (!panel) return ctx.response.notFound()
    const auth = (ctx as unknown as AuthContext).auth
    let authUser: LucidRow | null = null

    const guardName = panelGuard(panel)
    if (guardName) {
      if (!auth?.authenticateUsing || !auth.checkUsing || !auth.use)
        throw new Error(`Panel guard "${guardName}" is unavailable`)
      if (this.options.requireUser) {
        try {
          authUser = await auth.authenticateUsing([guardName])
        } catch (error) {
          return handleUnauthenticated(ctx, panel, error)
        }
      } else if (await auth.checkUsing([guardName])) {
        authUser = auth.user ?? null
      }
    } else {
      authUser = auth?.user ?? null
    }
    const config = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
    const user = userSummary(authUser, config)
    if (user && authUser && panel.auth.profile.avatar) {
      const avatarKey = (authUser as unknown as Record<string, unknown>)[config.auth.columns.avatar]
      if (typeof avatarKey === 'string' && avatarKey) {
        user.avatarUrl = await createPupitreStorage().url(avatarKey, { visibility: 'public' })
      }
    }
    ctx.pupitre = {
      panel,
      basePath: panel.path,
      locale: resolveLocale({
        user:
          authUser && (authUser as unknown as Record<string, unknown>)[config.auth.columns.locale],
        session: ctx.session?.get(`pupitre.locale.${panel.id}`),
        acceptLanguage: ctx.request.header('accept-language'),
        locales: panel.locales,
        defaultLocale: panel.locale,
      }),
      timezone: user?.timezone ?? panel.timezone ?? config.timezone ?? 'UTC',
      user,
      authUser,
      tenant: null,
    }
    const messages = getMessages(config, panel, ctx.pupitre.locale)
    requestMessages.set(ctx, messages)
    const send = ctx.response.send.bind(ctx.response)
    const resolvedPages = new WeakSet<object>()
    ctx.response.send = (body, ...args) =>
      send(
        typeof body === 'string'
          ? stripTranslationMarkers(body)
          : body && typeof body === 'object' && resolvedPages.has(body)
            ? body
            : resolveTranslations(body, ctx.pupitre.locale, messages),
        ...args
      )
    if (ctx.inertia) {
      const page = ctx.inertia.page.bind(ctx.inertia)
      ctx.inertia.page = async (...args) => {
        const resolved = resolveTranslations(await page(...args), ctx.pupitre.locale, messages)
        resolvedPages.add(resolved)
        return resolved
      }
    }
    if (
      this.options.requireUser &&
      panel.tenancy?.mode === 'url' &&
      authUser &&
      ctx.params.tenant === undefined
    ) {
      const adapter = await resolveTenancyAdapter(ctx)
      const memberships = adapter ? await adapter.listForUser(ctx) : []
      const membership = memberships[0]
      if (membership) {
        ctx.pupitre.tenant = membership
        ctx.pupitre.panel = bindPanel(
          panel,
          `${panel.path}/${membership.slug ?? encodeURIComponent(String(membership.id))}`
        )
      }
    }
    if (this.options.requireUser && authUser && panel.auth.emailVerification) {
      const attributes = authUser as unknown as Record<string, unknown>
      const verified = attributes[config.auth.columns.emailVerifiedAt]
      const verificationRoute = routeName.includes('.auth.verification.')
      const logoutRoute = routeName.endsWith('.auth.logout')
      if (!verified && !verificationRoute && !logoutRoute) {
        return ctx.response.redirect(`${ctx.pupitre.basePath}/email/verify`)
      }
    }
    if (this.options.requireUser && authUser && panel.auth.mfa?.required) {
      const attributes = authUser as unknown as Record<string, unknown>
      const enabled = attributes[config.auth.columns.mfaEnabledAt]
      const profileRoute = routeName.startsWith(`${panel.id}.profile`)
      const logoutRoute = routeName.endsWith('.auth.logout')
      if (!enabled && !profileRoute && !logoutRoute) {
        return ctx.response.redirect(`${ctx.pupitre.basePath}/profile`)
      }
    }
    try {
      await next()
    } catch (error) {
      if (error instanceof Error) {
        const translated = resolveTranslations(error.message, ctx.pupitre.locale, messages)
        const descriptor = Object.getOwnPropertyDescriptor(error, 'message')
        if (
          translated !== error.message &&
          (descriptor?.writable ||
            descriptor?.configurable ||
            (!descriptor && Object.isExtensible(error)))
        )
          Object.defineProperty(error, 'message', {
            value: translated,
            writable: true,
            configurable: true,
          })
      }
      throw error
    }
  }
}
