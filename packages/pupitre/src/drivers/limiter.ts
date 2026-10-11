import app from '@adonisjs/core/services/app'

/** Consume the optional host-configured limiter for the login attempt. */
export async function consumeLoginLimit(key: string): Promise<boolean> {
  if (!app.container.hasBinding('limiter.manager')) return false
  try {
    const { default: limiter } = await import('@adonisjs/limiter/services/main')
    await limiter.use({ requests: 5, duration: '1 minute' }).consume(key)
    return false
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'E_TOO_MANY_REQUESTS'
    ) {
      return true
    }
    if (error instanceof Error && error.message.includes('@adonisjs/limiter')) return false
    throw error
  }
}
/** Successful credential verification clears the failed-login attempt window. */
export async function clearLoginLimit(key: string): Promise<void> {
  if (!app.container.hasBinding('limiter.manager')) return
  // The limiter is an optional host dependency, so static imports would break hosts without it.
  const { default: limiter } = await import('@adonisjs/limiter/services/main')
  await limiter.use({ requests: 5, duration: '1 minute' }).delete(key)
}

/** Consume an action-specific host limiter; missing optional limiter is fail-open. */
export async function consumeActionLimit(
  key: string,
  limit: { maxAttempts: number; per: string }
): Promise<{ limited: boolean; retryAfter?: number }> {
  if (!app.container.hasBinding('limiter.manager')) return { limited: false }
  try {
    const { default: limiter } = await import('@adonisjs/limiter/services/main')
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
    if (error instanceof Error && error.message.includes('@adonisjs/limiter'))
      return { limited: false }
    throw error
  }
}
