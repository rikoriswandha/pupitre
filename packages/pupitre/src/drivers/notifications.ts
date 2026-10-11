import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { NotificationsAdapter, PupitreNotificationItem } from '../adapters/notifications.js'
import { E_PUPITRE_MISSING_PEER } from '../errors.js'

type NotificationRow = {
  id: string
  type: string
  data: Record<string, unknown> | string
  read_at: Date | string | null
  created_at: Date | string
}
type Owner = { notifiableType: string; notifiableId: string | number }

function serializedOwner(user: LucidRow): Owner {
  const id = user.$primaryKeyValue
  return {
    notifiableType: user.constructor.name,
    notifiableId: typeof id === 'number' ? id : String(id),
  }
}

function timestamp(value: Date | string | null): string | null {
  if (value === null) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function item(row: NotificationRow): PupitreNotificationItem {
  const data =
    typeof row.data === 'string' ? (JSON.parse(row.data) as Record<string, unknown>) : row.data
  const type =
    data.type === 'success' ||
    data.type === 'error' ||
    data.type === 'warning' ||
    data.type === 'info'
      ? data.type
      : 'info'
  const createdAt = timestamp(row.created_at)
  if (!createdAt) throw new Error(`Notification "${row.id}" has no creation timestamp`)
  return {
    id: row.id,
    type,
    title: String(data.title ?? row.type),
    ...(typeof data.body === 'string' ? { body: data.body } : {}),
    ...(typeof data.url === 'string' ? { url: data.url } : {}),
    readAt: timestamp(row.read_at),
    createdAt,
  }
}

/** Official adapter for @rikology/adonisjs-notifications database inbox. */
export function notificationsAdapter(): NotificationsAdapter {
  // The peer is optional, so its package must only load when the adapter is used.
  async function loadPeer() {
    try {
      const peer = await import('@rikology/adonisjs-notifications')
      return peer
    } catch (error) {
      if (
        error instanceof Error &&
        (('code' in error && error.code === 'ERR_MODULE_NOT_FOUND') ||
          ('code' in error && error.code === 'MODULE_NOT_FOUND'))
      ) {
        throw new E_PUPITRE_MISSING_PEER()
      }
      throw error
    }
  }

  async function queryDatabase() {
    try {
      const { default: db } = await import('@adonisjs/lucid/services/db')
      return db
    } catch (error) {
      if (
        error instanceof Error &&
        (('code' in error && error.code === 'ERR_MODULE_NOT_FOUND') ||
          ('code' in error && error.code === 'MODULE_NOT_FOUND'))
      ) {
        throw new E_PUPITRE_MISSING_PEER()
      }
      throw error
    }
  }

  return {
    async toInbox(user, message, _ctx?: HttpContext) {
      const peer = await loadPeer()
      class PupitreNotification extends peer.Notification {
        via() {
          return ['database']
        }
        toDatabase() {
          return message
        }
      }
      const { default: notifications } =
        await import('@rikology/adonisjs-notifications/services/main')
      await notifications.sendNow(user, new PupitreNotification())
    },
    async inbox(user, options) {
      await loadPeer()
      const db = await queryDatabase()
      const owner = serializedOwner(user)
      const page = Math.max(1, options.page)
      const perPage = Math.max(1, options.perPage)
      const [rows, count] = await Promise.all([
        db
          .from('notifications')
          .where('notifiable_type', owner.notifiableType)
          .where('notifiable_id', owner.notifiableId)
          .orderBy('created_at', 'desc')
          .offset((page - 1) * perPage)
          .limit(perPage),
        db
          .from('notifications')
          .where('notifiable_type', owner.notifiableType)
          .where('notifiable_id', owner.notifiableId)
          .count('* as total')
          .first(),
      ])
      const total = Number(count?.total ?? 0)
      return {
        items: (rows as NotificationRow[]).map(item),
        meta: {
          total,
          perPage,
          currentPage: page,
          lastPage: Math.max(1, Math.ceil(total / perPage)),
        },
      }
    },
    async unreadCount(user) {
      await loadPeer()
      const db = await queryDatabase()
      const owner = serializedOwner(user)
      const result = await db
        .from('notifications')
        .where('notifiable_type', owner.notifiableType)
        .where('notifiable_id', owner.notifiableId)
        .whereNull('read_at')
        .count('* as total')
        .first()
      return Number(result?.total ?? 0)
    },
    async markRead(user, ids) {
      await loadPeer()
      const db = await queryDatabase()
      const owner = serializedOwner(user)
      const query = db
        .from('notifications')
        .where('notifiable_type', owner.notifiableType)
        .where('notifiable_id', owner.notifiableId)
        .whereNull('read_at')
      if (ids !== 'all') {
        if (!ids.length) return
        query.whereIn('id', ids)
      }
      await query.update({ read_at: new Date() })
    },
  }
}
