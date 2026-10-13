import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { Database } from '@adonisjs/lucid/database'
import type { PanelRuntime } from '../manager.js'
import { DateTime } from 'luxon'
import string from '@adonisjs/core/helpers/string'
import { CookieClient } from '@adonisjs/core/http'
import { RememberMeToken } from '@adonisjs/auth/session'
import type { LucidAuthenticatable } from '@adonisjs/auth/types/session'

/** The guard emits the presented token, but its response cookie contains the recycled identity. */
async function issuedRememberIdentifier(ctx: HttpContext, panel: PanelRuntime) {
  const key = `remember_${panel.guard ?? 'web'}`
  const headers = ctx.response.getHeader('set-cookie')
  const cookie = (Array.isArray(headers) ? headers : [headers])
    .filter(
      (header): header is string => typeof header === 'string' && header.startsWith(`${key}=`)
    )
    .at(-1)
  if (!cookie) return null
  const value = new CookieClient(await ctx.containerResolver.make('encryption')).decrypt(
    key,
    decodeURIComponent(cookie.split(';')[0]!.slice(key.length + 1))
  )
  return RememberMeToken.decode(value)?.identifier ?? null
}

async function deleteRememberToken(ctx: HttpContext, userId: string, identifier: string) {
  const Model = ctx.pupitre.authUser?.constructor as LucidAuthenticatable | undefined
  if (!Model?.rememberMeTokens) throw new Error('Remember authentication requires a token provider')
  const user = await Model.find(userId)
  if (user) await Model.rememberMeTokens.delete(user, identifier)
}

export async function revokeBrowserSessions(
  ctx: HttpContext,
  rows: { id: string; user_id: string; remember_token_id: string | null }[]
) {
  const db = await sessionDatabase(ctx)
  for (const row of rows) {
    await db.from('pupitre_user_sessions').where('id', row.id).update({
      revoked_at: DateTime.utc().toSQL(),
    })
    if (row.remember_token_id) await deleteRememberToken(ctx, row.user_id, row.remember_token_id)
  }
}

const rememberExpirations = new WeakMap<HttpContext, Date>()
export function rememberSessionExpiration(event: {
  ctx: HttpContext
  guardName: string
  rememberMeToken?: { expiresAt: Date | null }
}) {
  if (!event.rememberMeToken?.expiresAt) return
  // Authentication events expose the old token after recycling. The newly
  // issued cookie carries the guard's configured lifetime, including defaults.
  const headers = event.ctx.response.getHeader('set-cookie')
  const cookie = (Array.isArray(headers) ? headers : [headers]).find(
    (header) => typeof header === 'string' && header.startsWith(`remember_${event.guardName}=`)
  )
  const maxAge =
    typeof cookie === 'string' ? /(?:^|;)\s*Max-Age=(\d+)/i.exec(cookie)?.[1] : undefined
  rememberExpirations.set(
    event.ctx,
    maxAge
      ? DateTime.utc()
          .plus({ seconds: Number(maxAge) })
          .toJSDate()
      : event.rememberMeToken.expiresAt
  )
}

export type AuthEvent = {
  event:
    | 'login'
    | 'logout'
    | 'failed'
    | 'mfa_failed'
    | 'session_revoked'
    | 'impersonation_started'
    | 'impersonation_stopped'
  userId?: string | number | null
  method?: string | null
}
export const sessionKey = (panel: PanelRuntime) => `pupitre.sessions.${panel.id}`
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
export async function sessionDatabase(ctx: HttpContext) {
  return (await ctx.containerResolver.make('lucid.db')) as Database
}
export async function recordAuthEvent(ctx: HttpContext, event: AuthEvent) {
  const panel = ctx.pupitre.panel
  if (!panel.sessions?.history) return
  const db = await sessionDatabase(ctx)
  await db.table('pupitre_login_events').insert({
    user_id: event.userId === null || event.userId === undefined ? null : String(event.userId),
    panel: panel.id,
    event: event.event,
    method: event.method ?? null,
    ip: ctx.request.ip(),
    user_agent: (ctx.request.header('user-agent') ?? '').slice(0, 512),
    created_at: DateTime.utc().toSQL(),
  })
}
export async function createBrowserSession(
  ctx: HttpContext,
  panel: PanelRuntime,
  userId: string | number | undefined,
  method: string,
  remember = false
) {
  if (!panel.sessions) return
  if (userId === undefined) throw new Error('Authenticated user requires a primary key')
  const token = randomBytes(32).toString('base64url')
  const now = DateTime.utc().toSQL()
  const expiresAt = remember
    ? rememberExpirations.get(ctx)
    : DateTime.utc()
        .plus({ seconds: string.seconds.parse(ctx.session.config.age) })
        .toJSDate()
  if (!expiresAt) throw new Error('Remember authentication requires a token expiration')
  const db = await sessionDatabase(ctx)
  const existing = ctx.session.get(sessionKey(panel))
  if (typeof existing === 'string') {
    const rows = await db
      .from('pupitre_user_sessions')
      .where('panel', panel.id)
      .where('guard', panel.guard ?? 'web')
      .where('token_hash', tokenHash(existing))
      .whereNull('revoked_at')
    await revokeBrowserSessions(ctx, rows)
  }
  const rememberTokenId = remember ? await issuedRememberIdentifier(ctx, panel) : null
  if (remember && !rememberTokenId)
    throw new Error('Remember authentication requires a token identity')
  await db.table('pupitre_user_sessions').insert({
    id: randomUUID(),
    user_id: String(userId),
    guard: panel.guard ?? 'web',
    panel: panel.id,
    token_hash: tokenHash(token),
    remember_token_id: rememberTokenId,
    ip: ctx.request.ip(),
    user_agent: (ctx.request.header('user-agent') ?? '').slice(0, 512),
    created_at: now,
    last_active_at: now,
    expires_at: DateTime.fromJSDate(expiresAt).toUTC().toSQL(),
    remembered: remember,
    revoked_at: null,
  })
  ctx.session.put(sessionKey(panel), token)
  await recordAuthEvent(ctx, { event: 'login', userId, method })
}

/** Runs for every panel group, including guest routes that silently authenticate. */
export async function restoreRememberedSession(ctx: HttpContext) {
  const panel = ctx.pupitre.panel
  if (!panel.sessions || !ctx.pupitre.authUser || ctx.session.get('pupitre.impersonation')) return
  const authContext = ctx as unknown as {
    auth: { use(name: string): { viaRemember: boolean; logout(): Promise<void> } }
  }
  const guard = authContext.auth.use(panel.guard ?? 'web')
  if (!guard.viaRemember) return
  const userId = ctx.pupitre.authUser.$primaryKeyValue
  const presented = RememberMeToken.decode(
    ctx.request.encryptedCookie(`remember_${panel.guard ?? 'web'}`)
  )?.identifier
  const issued = await issuedRememberIdentifier(ctx, panel)
  const expiresAt = rememberExpirations.get(ctx)
  const db = await sessionDatabase(ctx)
  const row = presented
    ? await ownedSessions(ctx, db, userId).where('remember_token_id', presented).first()
    : null
  if (!row || row.revoked_at || !issued || !expiresAt) {
    // logout() only sees the now-deleted presented token, not the recycled one.
    if (issued) await deleteRememberToken(ctx, String(userId), issued)
    await guard.logout()
    ctx.session.forget(sessionKey(panel))
    ctx.pupitre.authUser = null
    ctx.pupitre.user = null
    return false
  }
  const existing = ctx.session.get(sessionKey(panel))
  const token = typeof existing === 'string' ? existing : randomBytes(32).toString('base64url')
  const changed = await ownedSessions(ctx, db, userId)
    .where('id', row.id)
    .whereNull('revoked_at')
    .where('remember_token_id', presented!)
    .update({
      token_hash: tokenHash(token),
      remember_token_id: issued,
      expires_at: DateTime.fromJSDate(expiresAt).toUTC().toSQL(),
      last_active_at: DateTime.utc().toSQL(),
    })
  if (!Number(changed)) {
    await revokeBrowserSessions(ctx, [
      { id: row.id, user_id: String(userId), remember_token_id: issued },
    ])
    await guard.logout()
    ctx.session.forget(sessionKey(panel))
    ctx.pupitre.authUser = null
    ctx.pupitre.user = null
    return false
  }
  ctx.session.put(sessionKey(panel), token)
  if (typeof existing !== 'string' && ctx.request.method() === 'GET')
    await recordAuthEvent(ctx, { event: 'login', userId, method: 'remember' })
}
export function ownedSessions(ctx: HttpContext, db: Database, userId: string | number | undefined) {
  if (userId === undefined) throw new Error('Authenticated user requires a primary key')
  return db
    .from('pupitre_user_sessions')
    .where('user_id', String(userId))
    .where('panel', ctx.pupitre.panel.id)
    .where('guard', ctx.pupitre.panel.guard ?? 'web')
}
export async function revokeCurrentSession(ctx: HttpContext) {
  if (!ctx.pupitre.panel.sessions) return
  const token = ctx.session.get(sessionKey(ctx.pupitre.panel))
  const impersonation = ctx.session.get('pupitre.impersonation') as { actorId?: string } | undefined
  const userId = impersonation?.actorId ?? ctx.pupitre.authUser?.$primaryKeyValue
  if (typeof token === 'string' && userId !== undefined) {
    const db = await sessionDatabase(ctx)
    const rows = await ownedSessions(ctx, db, userId)
      .where('token_hash', tokenHash(token))
      .whereNull('revoked_at')
    await revokeBrowserSessions(ctx, rows)
    await recordAuthEvent(ctx, { event: 'logout', userId })
  }
  ctx.session.forget(sessionKey(ctx.pupitre.panel))
}
export function parseDevice(ua: string) {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser'
  const device = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Device'
  return { browser, device }
}
