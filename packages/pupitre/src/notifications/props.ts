import type { HttpContext } from '@adonisjs/core/http'
import type { PupitrePageProps } from '../../catalog/wire.js'
import { configuredNotifications } from './controller.js'

/** Builds the tray prop only when the panel, adapter, and authenticated user are available. */
export async function notificationProps(
  ctx: HttpContext
): Promise<PupitrePageProps['pupitre']['notifications']> {
  const { panel, authUser } = ctx.pupitre
  if (!panel.notifications || !authUser) return undefined
  const adapter = await configuredNotifications(ctx)
  if (!adapter) return undefined
  const unread = await adapter.unreadCount(authUser)
  const base = `${panel.path.replace(/\/$/, '')}/_pupitre/notifications`
  return { unread, url: base, readUrl: `${base}/read`, interval: panel.notifications.interval }
}
