import type { HttpContext } from '@adonisjs/core/http'

/** Auth-related URLs shared with the shell (WP17). */
export function authProps(ctx: HttpContext): { logoutUrl?: string; profileUrl?: string } {
  const panel = ctx.pupitre.panel
  if (!panel.auth.login) return {}
  return {
    logoutUrl: `${ctx.pupitre.basePath}/logout`,
    ...(panel.auth.profile?.enabled ? { profileUrl: `${ctx.pupitre.basePath}/profile` } : {}),
  }
}
