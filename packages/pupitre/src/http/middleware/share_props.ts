import type { HttpContext } from '@adonisjs/core/http'
import type { PupitrePageProps, ThemeVars } from '../../../catalog/wire.js'
import type { PanelRuntime } from '../../manager.js'
import { buildNavigation } from '../../navigation/build_nav.js'
import { buildUserMenu } from '../../navigation/user_menu.js'
import { authProps } from '../../auth/props.js'
import { tenancyProps } from '../../tenancy/props.js'
import { notificationProps } from '../../notifications/props.js'
import { searchProps } from '../../search/props.js'

type SharedPupitre = PupitrePageProps['pupitre']

/** Flattens the panel theme definition into the wire `ThemeVars` record. */
export function themeVars(panel: PanelRuntime): ThemeVars {
  const theme = panel.theme ?? {}
  return Object.fromEntries(
    [
      ...(theme.primary ? [['primary', theme.primary]] : []),
      ...(theme.darkMode ? [['darkMode', theme.darkMode]] : []),
      ...(theme.radius ? [['--radius', theme.radius]] : []),
      ...Object.entries(theme.vars ?? {}),
    ].filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
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
    notifications: Boolean(panel.notifications),
    globalSearch: Boolean(panel.globalSearch),
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
    locale: ctx.pupitre.locale,
    timezone: ctx.pupitre.timezone,
  }
}

export default class SharePropsMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    ctx.inertia.share({ pupitre: await buildSharedProps(ctx) })
    await next()
  }
}
