import { t } from '../i18n.js'
import { DateTime } from 'luxon'
import { randomBytes } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import app from '@adonisjs/core/services/app'
import type { PanelRuntime } from '../manager.js'
import type { PupitreConfig } from '../define_config.js'
import { completeLogin } from './login_flow.js'
import { allyFromContext } from '../drivers/ally.js'
import { authLimitResponse, authRateLimited } from './rate_limit.js'

type SocialContext = HttpContext & {
  pupitre: HttpContext['pupitre'] & { panel: PanelRuntime }
  session?: {
    flash(key: string, value: unknown): void
    get(key: string): unknown
    put(key: string, value: unknown): void
    forget(key: string): void
  }
}
type SocialQuery = {
  where(key: string, value: unknown): SocialQuery
  first(): Promise<LucidRow | null>
}
type UserModel = LucidModel & {
  findBy(key: string, value: unknown): Promise<LucidRow | null>
  create(data: Record<string, unknown>): Promise<LucidRow>
  query(): SocialQuery
}
type Database = {
  connection(): { schema: { hasColumn(table: string, column: string): Promise<boolean> } }
}

async function config(ctx: HttpContext): Promise<PupitreConfig> {
  return (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
}
async function model(cfg: PupitreConfig): Promise<UserModel> {
  if (!cfg.auth.model)
    throw new Error('E_PUPITRE_AUTH_MODEL_REQUIRED: configure pupitre.auth.model')
  const module = await cfg.auth.model()
  return module.default as UserModel
}
function safeRedirect(ctx: HttpContext, value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback
  try {
    const base = new URL(ctx.request.completeUrl())
    const target = new URL(value, base)
    return target.origin === base.origin
      ? `${target.pathname}${target.search}${target.hash}`
      : fallback
  } catch {
    return fallback
  }
}
function fail(ctx: SocialContext, message: string) {
  ctx.session?.flash('pupitre', [{ type: 'error', title: message }])
  return ctx.response.redirect(`${ctx.pupitre.basePath}/login`)
}

export default class SocialAuthController {
  async redirect(ctx: SocialContext) {
    const provider = String(ctx.params.provider)
    if (!ctx.pupitre.panel.social?.providers.includes(provider)) return ctx.response.notFound()
    const ally = await allyFromContext(ctx, provider)
    const returnTo = safeRedirect(ctx, ctx.request.input('redirect'), ctx.pupitre.basePath)
    ctx.session?.put(`pupitre.socialRedirect.${provider}`, returnTo)
    await ally.redirect()
    return ctx.response
  }

  async callback(ctx: SocialContext) {
    const provider = String(ctx.params.provider)
    const social = ctx.pupitre.panel.social
    if (!social?.providers.includes(provider)) return ctx.response.notFound()
    if (await authRateLimited(ctx, 'social-callback', 60)) return authLimitResponse(ctx)
    const ally = await allyFromContext(ctx, provider)
    if (ally.accessDenied()) return fail(ctx, t('Social sign-in was denied'))
    if (ally.stateMisMatch()) return fail(ctx, t('Social sign-in state did not match; try again'))
    if (ally.hasError()) return fail(ctx, t('The social provider returned an error'))

    const identity = await ally.user()
    const cfg = await config(ctx)
    const User = await model(cfg)
    const columns = cfg.auth.columns
    const db = (await app.container.make('lucid.db')) as unknown as Database
    const providerAttribute = columns.socialProvider
    const providerIdAttribute = columns.socialProviderId
    const hasProvider = await db.connection().schema.hasColumn('users', 'provider')
    const hasProviderId = await db.connection().schema.hasColumn('users', 'provider_id')
    const email = identity.email?.trim()

    let user: LucidRow | null = null
    if (hasProvider && hasProviderId && providerAttribute && providerIdAttribute) {
      user = await User.query()
        .where(providerAttribute, provider)
        .where(providerIdAttribute, identity.id)
        .first()
    }
    if (!user && email && identity.emailVerificationState === 'verified')
      user = await User.findBy(columns.email, email)
    if (!user) {
      if (!social.registration && !ctx.pupitre.panel.auth.registration)
        return fail(ctx, t('No account is linked to this social identity'))
      if (!email || identity.emailVerificationState !== 'verified')
        return fail(ctx, t('A verified email address is required to create an account'))
      const hasEmailVerifiedAt = await db
        .connection()
        .schema.hasColumn('users', 'email_verified_at')
      const values: Record<string, unknown> = {
        [columns.name]: identity.name || identity.nickName || email,
        [columns.email]: email,
        [columns.password]: randomBytes(32).toString('hex'),
        ...(hasEmailVerifiedAt ? { [columns.emailVerifiedAt]: DateTime.now() } : {}),
      }
      if (hasProvider && hasProviderId && providerAttribute && providerIdAttribute) {
        values[providerAttribute] = provider
        values[providerIdAttribute] = identity.id
      }
      user = await User.create(values)
    }

    const storedRedirect = ctx.session?.get(`pupitre.socialRedirect.${provider}`)
    ctx.session?.forget(`pupitre.socialRedirect.${provider}`)
    const redirect = safeRedirect(ctx, storedRedirect, ctx.pupitre.basePath)
    return completeLogin(ctx, ctx.pupitre.panel, user, { redirect })
  }
}
