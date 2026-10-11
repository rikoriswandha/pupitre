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
