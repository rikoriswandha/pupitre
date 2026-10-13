import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { sessionDatabase, sessionKey, tokenHash } from '../../auth/session_service.js'
import { t } from '../../i18n.js'
import string from '@adonisjs/core/helpers/string'

export default class BrowserSessionMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    const panel = ctx.pupitre.panel
    if (!panel.sessions || !ctx.pupitre.authUser) return next()
    const impersonation = ctx.session.get('pupitre.impersonation') as
      { actorId?: string } | undefined
    const userId = impersonation?.actorId ?? ctx.pupitre.authUser.$primaryKeyValue
    const token = ctx.session.get(sessionKey(panel))
    const db = await sessionDatabase(ctx)
    const row =
      typeof token === 'string'
        ? await db
            .from('pupitre_user_sessions')
            .where('token_hash', tokenHash(token))
            .where('panel', panel.id)
            .where('guard', panel.guard ?? 'web')
            .where('user_id', String(userId))
            .whereNull('revoked_at')
            .first()
        : null
    if (!row) {
      // Host guard names are runtime-configured rather than a fixed Auth type union.
      const authContext = ctx as unknown as {
        auth: { use(guard: string): { logout(): Promise<void> } }
      }
      await authContext.auth.use(panel.guard ?? 'web').logout()
      ctx.session.forget(sessionKey(panel))
      ctx.session.forget('pupitre.impersonation')
      ctx.session.flash('pupitre', [
        { type: 'error', title: t('Your browser session was revoked. Please sign in again.') },
      ])
      return ctx.response.redirect(`${ctx.pupitre.basePath}/login`)
    }
    const cutoff = DateTime.utc().minus({ minutes: 1 }).toSQL()
    await db
      .from('pupitre_user_sessions')
      .where('id', row.id)
      .where('last_active_at', '<=', cutoff)
      .update({
        last_active_at: DateTime.utc().toSQL(),
        ...(!row.remembered
          ? {
              expires_at: DateTime.utc()
                .plus({
                  seconds: string.seconds.parse(ctx.session.config.age),
                })
                .toSQL(),
            }
          : {}),
      })
    return next()
  }
}
