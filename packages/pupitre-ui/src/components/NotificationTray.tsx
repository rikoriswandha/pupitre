import { Popover } from '@base-ui/react/popover'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [refreshing, setRefreshing] = useState(false)
  const [unreadOverride, setUnreadOverride] = useState<{ source: number; value: number } | null>(
    null
  )
  const unreadProp = notifications?.unread ?? 0
  const unread = unreadOverride?.source === unreadProp ? unreadOverride.value : unreadProp
  const visit = useVisit()
  const inboxRequest = useRef<AbortController | null>(null)
  useEffect(() => {
    return () => {
      inboxRequest.current?.abort()
      inboxRequest.current = null
    }
  }, [notifications?.url])

  const fetchInbox = useCallback(async () => {
    if (!notifications) return
    inboxRequest.current?.abort()
    const controller = new AbortController()
    inboxRequest.current = controller
    setLoading(items.length === 0)
    setRefreshing(items.length > 0)
    try {
      const response = await jsonFetch(`${notifications.url}?page=1`, {
        signal: controller.signal,
      })
      if (!response.ok) return
      const result = notificationListSchema.safeParse(await response.json())
      if (result.success && inboxRequest.current === controller && !controller.signal.aborted) {
        setItems(result.data.items)
        setUnreadOverride({ source: unreadProp, value: result.data.unread })
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error
    } finally {
      if (inboxRequest.current === controller) {
        inboxRequest.current = null
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [items.length, notifications, unreadProp])
  useNotificationsPolling(notifications?.interval, () => {
    if (open) void fetchInbox()
  })

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
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) void fetchInbox()
        else {
          inboxRequest.current?.abort()
          inboxRequest.current = null
          setLoading(false)
          setRefreshing(false)
        }
      }}
    >
      <Popover.Trigger
        render={<Button type="button" variant="ghost" />}
        className="relative size-10 min-h-10 px-2"
        aria-label={t('Notifications')}
      >
        <Icon name="bell" className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Popover.Popup
            className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-none"
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
            <div className="max-h-96 overflow-y-auto" aria-busy={loading || refreshing}>
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
              {items.map((item) => (
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
                    {item.actions?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.actions.map((action, index) => (
                          <button
                            key={`${action.label}:${index}`}
                            type="button"
                            className="text-xs text-primary hover:underline"
                            onClick={async () => {
                              if (action.markAsRead && !item.readAt) await markRead([item.id])
                              if (action.url) {
                                setOpen(false)
                                visit(action.url, {
                                  method: action.method ?? 'get',
                                  preserveScroll: true,
                                })
                              }
                            }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
