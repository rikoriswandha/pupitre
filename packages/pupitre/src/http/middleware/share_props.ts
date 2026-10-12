import type { HttpContext } from '@adonisjs/core/http'
import type { PupitrePageProps, ThemeVars } from '../../../catalog/wire.js'
import type { PanelRuntime } from '../../manager.js'
import { buildNavigation } from '../../navigation/build_nav.js'
import { buildUserMenu } from '../../navigation/user_menu.js'
import { authProps } from '../../auth/props.js'
import { tenancyProps } from '../../tenancy/props.js'
import { notificationProps } from '../../notifications/props.js'
import { searchProps } from '../../search/props.js'
import type PupitreManager from '../../manager.js'
import { realtimeChannels } from '../../adapters/realtime.js'
import { requestMessages, resolveTranslations } from '../../i18n.js'
import type { PupitreConfig } from '../../define_config.js'
import clientKeys from '../../locales/client_keys.js'

type SharedPupitre = PupitrePageProps['pupitre']

/** Compiles the validated panel theme into CSS variables and shell settings. */
export function themeVars(panel: PanelRuntime): ThemeVars {
  const theme = panel.theme ?? {}
  const vars = {
    ...(theme.primary ? { '--primary': theme.primary } : {}),
    ...(theme.radius ? { '--radius': theme.radius } : {}),
    ...(theme.font ? { '--font-sans': theme.font.family } : {}),
    ...(theme.colors
      ? Object.fromEntries(
          Object.entries(theme.colors).map(([name, value]) => [`--${name}`, value])
        )
      : {}),
    ...(theme.density ? { '--pupitre-density': theme.density === 'compact' ? '0.75' : '1' } : {}),
    ...(theme.vars ?? {}),
  }
  return {
    ...(theme.primary ? { primary: theme.primary } : {}),
    ...(theme.darkMode ? { darkMode: theme.darkMode } : {}),
    ...(theme.radius ? { radius: theme.radius } : {}),
    vars,
    ...(theme.font
      ? { fontFamily: theme.font.family, ...(theme.font.url ? { fontUrl: theme.font.url } : {}) }
      : {}),
    ...(theme.density ? { density: theme.density } : {}),
    ...(theme.sidebar ? { sidebar: theme.sidebar } : {}),
    ...(theme.sidebarCollapsibleOnDesktop !== undefined
      ? { sidebarCollapsibleOnDesktop: theme.sidebarCollapsibleOnDesktop }
      : {}),
    ...(theme.contentWidth ? { contentWidth: theme.contentWidth } : {}),
    ...(theme.stylesheet ? { stylesheet: theme.stylesheet } : {}),
  }
}

/** Feature flags the client uses to show/hide built-in shell affordances. */
export function panelFeatures(panel: PanelRuntime): Record<string, boolean> {
  return {
    login: panel.auth.login,
    registration: panel.auth.registration,
    passwordReset: panel.auth.passwordReset,
    emailVerification: panel.auth.emailVerification,
    profile: panel.auth.profile?.enabled ?? false,
    tenancy: Boolean(panel.tenancy),
    mfa: Boolean(panel.auth.mfa),
    passkeys: Boolean(panel.auth.passkeys?.enabled),
    notifications: Boolean(panel.notifications),
    globalSearch: Boolean(panel.globalSearch),
    ...Object.fromEntries(
      (panel.social?.providers ?? []).map((provider) => [`social:${provider}`, true])
    ),
  }
}

/** Builds the `pupitre` shared prop for the current request. */
export async function buildSharedProps(ctx: HttpContext): Promise<SharedPupitre> {
  const panel = ctx.pupitre.panel
  const session = (
    ctx as HttpContext & { session?: { flashMessages?: { get(key: string): unknown } } }
  ).session
  const flashValue = session?.flashMessages?.get('pupitre')
  const flash = Array.isArray(flashValue) ? flashValue : flashValue ? [flashValue] : []
  const tenantUnbound = panel.tenancy?.mode === 'url' && panel.path === ctx.pupitre.basePath
  const search = tenantUnbound ? undefined : searchProps(ctx)
  const notifications = tenantUnbound ? undefined : await notificationProps(ctx)
  const manager = (await ctx.containerResolver.make('pupitre.manager')) as PupitreManager
  const config = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
  const messages = requestMessages.get(ctx) ?? {}
  const clientMessages = Object.fromEntries(
    clientKeys.filter((key) => messages[key] !== undefined).map((key) => [key, messages[key]])
  )
  const fallback = config.i18n?.fallbackLocale ?? 'en'
  for (const contributions of [
    ...(panel.plugins ?? []).map((plugin) => plugin.messages),
    config.i18n?.messages,
  ]) {
    for (const locale of ctx.pupitre.locale === 'en' ? ['en'] : [fallback, ctx.pupitre.locale]) {
      for (const key of Object.keys(contributions?.[locale] ?? {}))
        clientMessages[key] = messages[key]
    }
  }
  for (const key of Object.keys(clientMessages)) {
    if (clientMessages[key] === key) delete clientMessages[key]
  }
  const realtime =
    manager.realtime && ctx.pupitre.user
      ? {
          driver: manager.realtime.driver,
          userChannel: realtimeChannels.user(panel.id, ctx.pupitre.user.id),
        }
      : undefined
  return {
    panel: {
      id: panel.id,
      path: panel.path,
      brand: panel.brand ?? { name: panel.id },
      theme: themeVars(panel),
      features: panelFeatures(panel),
      ...authProps(ctx),
      userMenu: await buildUserMenu(ctx),
      ...(search ? { search } : {}),
    },
    user: ctx.pupitre.user,
    ...(await tenancyProps(ctx)),
    nav: tenantUnbound ? [] : await buildNavigation(ctx),
    flash,
    ...(notifications ? { notifications } : {}),
    ...(realtime ? { realtime } : {}),
    locale: ctx.pupitre.locale,
    locales: [...(panel.locales ?? [panel.locale ?? 'en'])],
    ...(Object.keys(clientMessages).length ? { messages: clientMessages } : {}),
    timezone: ctx.pupitre.timezone,
  }
}

export default class SharePropsMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    ctx.inertia.share({
      pupitre: resolveTranslations(
        await buildSharedProps(ctx),
        ctx.pupitre.locale,
        requestMessages.get(ctx) ?? {}
      ),
    })
    await next()
  }
}
