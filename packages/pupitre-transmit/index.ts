import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import {
  authorizeResource,
  panelGuard,
  realtimeChannels,
  resolveTenancyAdapter,
} from '@rikology/pupitre'
import type { PupitreManager, RealtimeAdapter } from '@rikology/pupitre'
import type { PupitreConfig } from '@rikology/pupitre'
import type { RealtimeEvent } from '@rikology/pupitre/catalog'

export type TransmitService = {
  broadcast(channel: string, event: RealtimeEvent): void
  authorize(
    channel: string,
    callback: (ctx: HttpContext, params: Record<string, string>) => boolean | Promise<boolean>
  ): void
}
export type TransmitRealtimeOptions = { service?: TransmitService }

/** Authenticated, tenant-scoped ping transport. The host registers Transmit's routes. */
export function transmitRealtime(options: TransmitRealtimeOptions = {}): RealtimeAdapter {
  // The Adonis service singleton waits for app.booted; importing at module
  // scope would prevent isolated adapter tests from booting their own app.
  let service: TransmitService | undefined = options.service
  async function getService(): Promise<TransmitService> {
    if (!service) {
      const module = await import('@adonisjs/transmit/services/main')
      service = module.default
    }
    return service
  }
  async function authorize(
    manager: PupitreManager,
    ctx: HttpContext,
    params: Record<string, string>,
    userChannel: boolean
  ): Promise<boolean> {
    const panel = manager.getPanel(decodeURIComponent(params.panel))
    if (!panel) return false
    const guard = panelGuard(panel)
    const { auth } = ctx as unknown as {
      auth?: {
        user?: LucidRow
        authenticateUsing(guards: string[]): Promise<LucidRow>
      }
    }
    const user = guard ? await auth?.authenticateUsing([guard]) : auth?.user
    const userId = user?.$primaryKeyValue
    if (!user || userId === undefined) return false
    if (panel.auth.emailVerification || panel.auth.mfa?.required) {
      const config = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
      const attributes = user as unknown as Record<string, unknown>
      if (panel.auth.emailVerification && !attributes[config.auth.columns.emailVerifiedAt])
        return false
      if (panel.auth.mfa?.required && !attributes[config.auth.columns.mfaEnabledAt]) return false
    }
    if (userChannel) return String(userId) === decodeURIComponent(params.id)
    const resource = panel.resources.find(
      (item) => item.slug === decodeURIComponent(params.resource)
    )
    if (!resource) return false
    // Transmit routes do not run Pupitre middleware. Bind a minimal, request-local
    // context for the existing tenancy adapter and Bouncer policy evaluation.
    const previous = ctx.pupitre
    ctx.pupitre = {
      panel,
      basePath: panel.path,
      locale: panel.locale ?? 'en',
      numberLocale: panel.numberLocale ?? panel.locale ?? 'en',
      timezone: panel.timezone ?? 'UTC',
      authUser: user,
      user: { id: userId, name: '', email: '' },
      tenant: null,
    }
    try {
      if (params.tenant !== undefined) {
        if (!panel.tenancy) return false
        const adapter = await resolveTenancyAdapter(ctx)
        const memberships = adapter ? await adapter.listForUser(ctx) : []
        const membership = memberships.find(
          (tenant) => String(tenant.id) === decodeURIComponent(params.tenant)
        )
        if (!membership) return false
        ctx.pupitre.tenant = membership
      } else if (panel.tenancy) {
        // Tenant resources never publish to an unscoped channel.
        return false
      }
      return await authorizeResource(ctx, resource, 'viewAny')
    } finally {
      ctx.pupitre = previous
    }
  }
  return {
    driver: 'transmit',
    async publish(channel, event) {
      const transmit = await getService()
      transmit.broadcast(channel, event)
    },
    async initialize(manager) {
      const transmit = await getService()
      const secure =
        (userChannel: boolean) => async (ctx: HttpContext, params: Record<string, string>) => {
          try {
            return await authorize(manager, ctx, params, userChannel)
          } catch {
            return false
          }
        }
      transmit.authorize(realtimeChannels.patterns.user, secure(true))
      transmit.authorize(realtimeChannels.patterns.resource, secure(false))
      transmit.authorize(realtimeChannels.patterns.tenantResource, secure(false))
    },
  }
}
