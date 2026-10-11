import { createHash } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import { consumeLoginLimit } from '../drivers/limiter.js'

/**
 * Scope expensive auth work by panel and IP/user, never by attacker-rotatable input.
 * `maxAttempts` is per minute; endpoints hit on every normal sign-in (login) need a
 * budget that tolerates shared IPs, while per-identity failure keys stay strict.
 */
export async function authRateLimited(
  ctx: HttpContext,
  action: string,
  maxAttempts = 5
): Promise<boolean> {
  const userId = ctx.pupitre.authUser?.$primaryKeyValue
  const key = createHash('sha256')
    .update(`auth:${ctx.pupitre.panel.id}:${action}:${userId ?? ctx.request.ip()}`)
    .digest('hex')
  return consumeLoginLimit(key, maxAttempts)
}

export function authLimitResponse(
  ctx: HttpContext,
  field?: string,
  message = 'Too many attempts. Try again in one minute.'
) {
  ctx.response.header('Retry-After', '60')
  if (ctx.request.header('x-inertia') || ctx.request.accepts(['json', 'html']) === 'html') {
    if (field) ctx.session?.flash('inputErrorsBag', { [field]: message })
    else ctx.session?.flash('pupitre', [{ type: 'error', title: message }])
    return ctx.response.redirect().back()
  }
  return ctx.response.status(429).json({ message })
}
