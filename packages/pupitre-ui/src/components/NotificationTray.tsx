import { useCallback, useState } from 'react'
import type { NotificationItem, PupitrePageProps } from '@rikology/pupitre/catalog'
import { notificationListResponse as notificationListSchema } from '@rikology/pupitre/catalog'
import { jsonFetch, t, useNotificationsPolling, useVisit } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { Button } from '../primitives/index.js'

export type NotificationTrayProps = {
  notifications: PupitrePageProps['pupitre']['notifications']
}

/** Bell, inbox popover, and read actions for database notifications. */
export function NotificationTray({ notifications }: NotificationTrayProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [unreadOverride, setUnreadOverride] = useState<{ source: number; value: number } | null>(
    null
  )
  const unreadProp = notifications?.unread ?? 0
  const unread = unreadOverride?.source === unreadProp ? unreadOverride.value : unreadProp
  const visit = useVisit()
  useNotificationsPolling(notifications?.interval)

  const fetchInbox = useCallback(async () => {
    if (!notifications) return
    setLoading(true)
    try {
      const response = await jsonFetch(`${notifications.url}?page=1`)
      if (!response.ok) return
      const result = notificationListSchema.safeParse(await response.json())
      if (result.success) {
        setItems(result.data.items)
        setUnreadOverride({ source: unreadProp, value: result.data.unread })
      }
    } finally {
      setLoading(false)
    }
  }, [notifications, unreadProp])

  const markRead = useCallback(
    async (ids: string[] | 'all') => {
      if (!notifications) return
      const response = await jsonFetch(notifications.readUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ ids }),
      })
      if (!response.ok) return
      const selected = ids === 'all' ? new Set(items.map((item) => item.id)) : new Set(ids)
      setItems((current) =>
        current.map((item) =>
          selected.has(item.id) ? { ...item, readAt: new Date().toISOString() } : item
        )
      )
      setUnreadOverride({
        source: unreadProp,
        value: ids === 'all' ? 0 : Math.max(0, unread - selected.size),
      })
    },
    [items, notifications, unread, unreadProp]
  )

  if (!notifications) return null
  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        className="relative size-10 min-h-10 px-2"
        aria-label={t('Notifications')}
        aria-expanded={open}
        onClick={() => {
          const nextOpen = !open
          setOpen(nextOpen)
          if (nextOpen) void fetchInbox()
        }}
      >
        <Icon name="bell" className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>
      {open && (
        <section
          className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
          aria-label={t('Notifications')}
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{t('Notifications')}</h2>
            <Button
              type="button"
              variant="ghost"
              className="min-h-8 px-2 text-xs"
              disabled={!unread}
              onClick={() => void markRead('all')}
            >
              {t('Mark all read')}
            </Button>
          </header>
          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {t('Loading notifications…')}
              </p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t('You’re all caught up.')}
              </p>
            )}
            {!loading &&
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 border-b border-border/70 px-4 py-3 last:border-0"
                >
                  <span
                    className={`mt-1 size-2 shrink-0 rounded-full ${item.readAt ? 'bg-muted' : 'bg-primary'}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    {item.url ? (
                      <a
                        className="text-sm font-medium hover:underline"
                        href={item.url}
                        onClick={(event) => {
                          event.preventDefault()
                          if (!item.readAt) void markRead([item.id])
                          setOpen(false)
                          visit(item.url!)
                        }}
                      >
                        {item.title}
                      </a>
                    ) : (
                      <p className="text-sm font-medium">{item.title}</p>
                    )}
                    {item.body && <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>}
                    {!item.readAt && (
                      <button
                        type="button"
                        className="mt-2 text-xs text-primary hover:underline"
                        onClick={() => void markRead([item.id])}
                      >
                        {t('Mark read')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  )
}
