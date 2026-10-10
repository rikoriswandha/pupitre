import type { HttpContext } from '@adonisjs/core/http'
import type PupitreManager from '../../manager.js'
import type { PupitreConfig } from '../../define_config.js'

export default class PupitreContextMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    const manager = (await ctx.containerResolver.make('pupitre.manager')) as PupitreManager
    const routeName = ctx.route?.name ?? ''
    const panelId = routeName.split('.')[0]
    const panel = manager.getPanel(panelId)
    if (!panel) return ctx.response.notFound()

    const auth = ctx as unknown as {
      auth?: {
        user?: Record<string, unknown> | null
        use(guard: string): { authenticate(): Promise<Record<string, unknown>> }
      }
    }
    let authUser: Record<string, unknown> | null | undefined
    if (panel.guard) {
      if (!auth.auth?.use) throw new Error(`Panel guard "${panel.guard}" is unavailable`)
      authUser = await auth.auth.use(panel.guard).authenticate()
    } else {
      authUser = auth.auth?.user ?? null
    }
    const user = authUser
      ? {
          id: authUser.id as string | number,
          name: String(authUser.name ?? authUser.fullName ?? authUser.email ?? ''),
          email: String(authUser.email ?? ''),
          ...(typeof authUser.avatarUrl === 'string' ? { avatarUrl: authUser.avatarUrl } : {}),
          ...(typeof authUser.timezone === 'string' ? { timezone: authUser.timezone } : {}),
        }
      : null
    const config = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
    ctx.pupitre = {
      panel,
      locale: panel.locale ?? 'en',
      timezone: user?.timezone ?? panel.timezone ?? config.timezone ?? 'UTC',
      user,
    }
    await next()
  }
}
