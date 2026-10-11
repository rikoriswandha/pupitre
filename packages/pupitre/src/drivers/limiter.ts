import app from '@adonisjs/core/services/app'
import type { LimiterService } from '@adonisjs/limiter/types'

const budgets = new WeakMap<object, Map<string, { count: number; expiresAt: number }>>()
const AUTH_WINDOW_MS = 60_000
const AUTH_MAX_ENTRIES = 10_000

/**
 * Consumes one attempt from a one-minute auth window (`maxAttempts`, default 5).
 * Single-process fallback only; clustered hosts must install a shared limiter store.
 */
export async function consumeLoginLimit(key: string, maxAttempts = 5): Promise<boolean> {
  if (app.container.hasBinding('limiter.manager')) {
    const result = await consumeActionLimit(key, { maxAttempts, per: '1 minute' })
    return result.limited
  }
  let authAttempts = budgets.get(app.container)
  if (!authAttempts) {
    authAttempts = new Map()
    budgets.set(app.container, authAttempts)
  }
  const now = Date.now()
  for (const [entryKey, entry] of authAttempts) {
    if (entry.expiresAt <= now) authAttempts.delete(entryKey)
  }
  let entry = authAttempts.get(key)
  if (!entry) {
    if (authAttempts.size >= AUTH_MAX_ENTRIES) {
      const oldest = authAttempts.keys().next().value
      if (oldest !== undefined) authAttempts.delete(oldest)
    }
    entry = { count: 0, expiresAt: now + AUTH_WINDOW_MS }
    authAttempts.set(key, entry)
  }
  if (entry.count >= maxAttempts) return true
  entry.count++
  return false
}

/** Successful credential verification clears the failed-login attempt window. */
export async function clearLoginLimit(key: string): Promise<void> {
  budgets.get(app.container)?.delete(key)
  if (!app.container.hasBinding('limiter.manager')) return
  const limiter: LimiterService = await app.container.make('limiter.manager')
  await limiter.use({ requests: 5, duration: '1 minute' }).delete(key)
}

/** Consume an action-specific host limiter; missing optional limiter is fail-open. */
export async function consumeActionLimit(
  key: string,
  limit: { maxAttempts: number; per: string }
): Promise<{ limited: boolean; retryAfter?: number }> {
  if (!app.container.hasBinding('limiter.manager')) return { limited: false }
  try {
    const limiter: LimiterService = await app.container.make('limiter.manager')
    await limiter.use({ requests: limit.maxAttempts, duration: limit.per }).consume(key)
    return { limited: false }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'E_TOO_MANY_REQUESTS'
    ) {
      const response =
        'response' in error && error.response && typeof error.response === 'object'
          ? error.response
          : undefined
      const retryAfter =
        response && 'availableIn' in response && typeof response.availableIn === 'number'
          ? response.availableIn
          : 'retryAfter' in error && typeof error.retryAfter === 'number'
            ? error.retryAfter
            : 60
      return { limited: true, retryAfter }
    }
    // An installed but broken limiter must not silently disable throttling.
    throw error
  }
}
