import type { HttpContext } from '@adonisjs/core/http'
import type PupitreManager from './manager.js'
import { realtimeChannels } from './adapters/realtime.js'

/** Returns a tenant-scoped table subscription only when realtime is configured. */
export async function resourceRealtime(ctx: HttpContext, slug: string) {
  const manager = (await ctx.containerResolver.make('pupitre.manager')) as PupitreManager
  if (!manager.realtime) return undefined
  return { channel: realtimeChannels.resource(ctx.pupitre.panel.id, slug, ctx.pupitre.tenant?.id) }
}

/** Publish only after the caller's mutation has committed. Delivery is best effort. */
export async function publishResourceChange(ctx: HttpContext, slug: string): Promise<void> {
  try {
    const manager = (await ctx.containerResolver.make('pupitre.manager')) as PupitreManager
    await manager.publishRealtime(
      realtimeChannels.resource(ctx.pupitre.panel.id, slug, ctx.pupitre.tenant?.id),
      { type: 'pupitre:table', resource: slug }
    )
  } catch (error) {
    ctx.logger.error({ err: error }, 'Pupitre realtime publish failed')
  }
}

/** Each enabled panel has its own subscription to the shared user inbox. */
export async function publishUserNotification(
  manager: PupitreManager,
  userId: string | number
): Promise<void> {
  await Promise.all(
    manager.panels
      .filter((panel) => panel.notifications !== null)
      .map((panel) =>
        manager.publishRealtime(realtimeChannels.user(panel.id, userId), {
          type: 'pupitre:notification',
        })
      )
  )
}

/** Store inbox messages before calling this helper. */
export async function publishNotification(
  ctx: HttpContext,
  userId: string | number
): Promise<void> {
  try {
    const manager = (await ctx.containerResolver.make('pupitre.manager')) as PupitreManager
    await publishUserNotification(manager, userId)
  } catch (error) {
    ctx.logger.error({ err: error }, 'Pupitre realtime publish failed')
  }
}
