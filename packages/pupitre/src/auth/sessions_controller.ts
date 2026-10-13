import type { HttpContext } from '@adonisjs/core/http'
import type { PupitreConfig } from '../define_config.js'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import {
  ownedSessions,
  sessionDatabase,
  sessionKey,
  tokenHash,
  parseDevice,
  recordAuthEvent,
  revokeBrowserSessions,
} from './session_service.js'
import { authenticationOptions, verifyAuthentication } from './passkey_service.js'
import { E_PUPITRE_FORBIDDEN } from '../errors.js'
import { t } from '../i18n.js'

const sessionIdentifier = vine.compile(vine.object({ id: vine.string().uuid() }))
const confirmation = vine.compile(
  vine.object({ current_password: vine.string().optional(), credential: vine.any().optional() })
)
function identity(ctx: HttpContext) {
  if (
    !ctx.pupitre.panel.sessions ||
    !ctx.pupitre.authUser ||
    ctx.session.get('pupitre.impersonation')
  )
    throw new E_PUPITRE_FORBIDDEN()
  return ctx.pupitre.authUser
}
export default class SessionsController {
  async index(ctx: HttpContext) {
    const user = identity(ctx)
    const db = await sessionDatabase(ctx)
    const token = ctx.session.get(sessionKey(ctx.pupitre.panel))
    const rows = await ownedSessions(ctx, db, user.$primaryKeyValue)
      .whereNull('revoked_at')
      .where('expires_at', '>', DateTime.utc().toSQL())
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
    const events = ctx.pupitre.panel.sessions?.history
      ? await db
          .from('pupitre_login_events')
          .where('user_id', String(user.$primaryKeyValue))
          .where('panel', ctx.pupitre.panel.id)
          .orderBy('created_at', 'desc')
          .orderBy('id', 'desc')
          .limit(10)
          .select('event', 'method', 'ip', 'created_at')
      : []
    return ctx.response.json({
      sessions: rows.map((row) => ({
        id: row.id,
        ip: row.ip,
        lastActiveAt: row.last_active_at,
        current: typeof token === 'string' && row.token_hash === tokenHash(token),
        ...parseDevice(row.user_agent),
      })),
      events,
    })
  }
  async revoke(ctx: HttpContext) {
    const user = identity(ctx)
    let id: string
    try {
      const input = await sessionIdentifier.validate(ctx.params)
      id = input.id
    } catch {
      return ctx.response.notFound()
    }
    const db = await sessionDatabase(ctx)
    const rows = await ownedSessions(ctx, db, user.$primaryKeyValue)
      .where('id', id)
      .whereNull('revoked_at')
    if (!rows.length) return ctx.response.notFound()
    await revokeBrowserSessions(ctx, rows)
    await recordAuthEvent(ctx, { event: 'session_revoked', userId: user.$primaryKeyValue })
    return ctx.response.noContent()
  }
  async options(ctx: HttpContext) {
    identity(ctx)
    if (!ctx.pupitre.panel.auth.passkeys?.enabled) throw new E_PUPITRE_FORBIDDEN()
    const cfg = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
    return ctx.response.json(await authenticationOptions(ctx, cfg))
  }
  async revokeOthers(ctx: HttpContext) {
    const user = identity(ctx)
    const cfg = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
    const input = await confirmation.validate(ctx.request.all())
    let verified = false
    if (user.$attributes[cfg.auth.columns.password]) {
      if (input.current_password) {
        const modelModule = await cfg.auth.model!()
        const Model = modelModule.default as LucidModel & {
          verifyCredentials(email: string, password: string): Promise<unknown>
        }
        try {
          await Model.verifyCredentials(
            String(user.$attributes[cfg.auth.columns.email]),
            input.current_password
          )
          verified = true
        } catch {
          verified = false
        }
      }
    } else if (ctx.pupitre.panel.auth.passkeys?.enabled && input.credential) {
      const assertion = await verifyAuthentication(ctx, cfg, input.credential)
      verified = Boolean(
        assertion?.userVerified && String(assertion.userId) === String(user.$primaryKeyValue)
      )
    }
    if (!verified)
      return ctx.response
        .status(422)
        .json({ message: t('Confirm your identity to log out other browser sessions.') })
    const token = ctx.session.get(sessionKey(ctx.pupitre.panel))
    if (typeof token !== 'string') throw new E_PUPITRE_FORBIDDEN()
    const db = await sessionDatabase(ctx)
    const rows = await ownedSessions(ctx, db, user.$primaryKeyValue)
      .whereNot('token_hash', tokenHash(token))
      .whereNull('revoked_at')
    await revokeBrowserSessions(ctx, rows)
    await recordAuthEvent(ctx, { event: 'session_revoked', userId: user.$primaryKeyValue })
    return ctx.response.noContent()
  }
}
