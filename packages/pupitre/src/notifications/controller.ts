import type { HttpContext } from '@adonisjs/core/http'
import type { PupitreNotificationItem } from '../adapters/notifications.js'
import { resolveAdapter } from '../define_config.js'
import type { PupitreConfig } from '../define_config.js'
import { notificationsReadRequest } from '../../catalog/wire.js'

const PER_PAGE = 20

async function getAdapter(ctx: HttpContext) {
  const config = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
  return resolveAdapter(config.notifications)
}

function serializePageMeta(page: number, perPage: number, total: number) {
  return {
    total,
    perPage,
    currentPage: page,
    lastPage: Math.max(1, Math.ceil(total / perPage)),
  }
}

export default class NotificationController {
  async index(ctx: HttpContext) {
    if (!ctx.pupitre.panel.notifications) return ctx.response.notFound()
    const adapter = await getAdapter(ctx)
    if (!adapter || !ctx.pupitre.authUser) return ctx.response.notFound()
    const rawPage = Number(ctx.request.input('page', 1))
    const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1
    const [inbox, unread] = await Promise.all([
      adapter.inbox(ctx.pupitre.authUser, { page, perPage: PER_PAGE }, ctx),
      adapter.unreadCount(ctx.pupitre.authUser, ctx),
    ])
    const items: PupitreNotificationItem[] = inbox.items
    return ctx.response.json({
      items,
      unread,
      meta: inbox.meta ?? serializePageMeta(page, PER_PAGE, items.length),
    })
  }

  async read(ctx: HttpContext) {
    if (!ctx.pupitre.panel.notifications) return ctx.response.notFound()
    const adapter = await getAdapter(ctx)
    if (!adapter || !ctx.pupitre.authUser) return ctx.response.notFound()
    const parsed = notificationsReadRequest.safeParse(ctx.request.all())
    if (!parsed.success)
      return ctx.response.badRequest({ message: 'Invalid notification read request' })
    await adapter.markRead(ctx.pupitre.authUser, parsed.data.ids, ctx)
    return ctx.response.noContent()
  }
}

export async function configuredNotifications(ctx: HttpContext) {
  const config = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
  return resolveAdapter(config.notifications)
}
