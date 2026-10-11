import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { NotificationAction } from '../definition/action.js'

/** A database notification as shown in the panel tray. */
export type PupitreNotificationItem = {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  body?: string
  url?: string
  actions?: NotificationAction[]
  readAt: string | null
  createdAt: string
}

export type PupitreNotificationMessage = Omit<
  PupitreNotificationItem,
  'id' | 'readAt' | 'createdAt'
>

/**
 * Notifications adapter (DESIGN §Adapters). Official driver over
 * `@rikology/adonisjs-notifications`: `@rikology/pupitre/drivers/notifications`.
 * Without an adapter only flash messages work.
 */
export interface NotificationsAdapter {
  toInbox(user: LucidRow, message: PupitreNotificationMessage, ctx?: HttpContext): Promise<void>
  inbox(
    user: LucidRow,
    options: { page: number; perPage: number },
    ctx?: HttpContext
  ): Promise<{
    items: PupitreNotificationItem[]
    meta: { total: number; perPage: number; currentPage: number; lastPage: number }
  }>
  unreadCount(user: LucidRow, ctx?: HttpContext): Promise<number>
  markRead(user: LucidRow, ids: string[] | 'all', ctx?: HttpContext): Promise<void>
}
