import { getMessages, resolveLocale, resolveTranslations, t } from '../i18n.js'
import type { HttpContext } from '@adonisjs/core/http'
import type { PanelRuntime } from '../manager.js'
import type { PupitreConfig } from '../define_config.js'

/**
 * Called by `pupitre_context` when the panel guard fails to authenticate.
 * With `.login()` enabled the panel answers itself (redirect to its login
 * page); otherwise the guard error propagates to the host (WP17).
 */
export async function handleUnauthenticated(
  ctx: HttpContext,
  panel: PanelRuntime,
  error: unknown
): Promise<unknown> {
  if (!panel.auth.login) throw error

  const accept = ctx.request.header('accept') ?? ''
  if (ctx.request.header('x-pupitre-action') === '1' || accept.includes('application/json')) {
    const config = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
    const locale = resolveLocale({
      session: ctx.session?.get(`pupitre.locale.${panel.id}`),
      acceptLanguage: ctx.request.header('accept-language'),
      locales: panel.locales,
      defaultLocale: panel.locale,
    })
    return ctx.response.status(401).json({
      message: resolveTranslations(
        t('Unauthenticated'),
        locale,
        getMessages(config, panel, locale)
      ),
    })
  }

  const requested = ctx.request.url(true)
  const target = requested.startsWith('/') && !requested.startsWith('//') ? requested : panel.path
  return ctx.response.redirect(`${panel.path}/login?redirect=${encodeURIComponent(target)}`)
}
