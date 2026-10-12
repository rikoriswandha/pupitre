import { Popover } from '@base-ui/react/popover'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { NotificationItem, PupitrePageProps } from '@rikology/pupitre/catalog'
import { notificationListResponse as notificationListSchema } from '@rikology/pupitre/catalog'
import { jsonFetch, t, useNotificationsPolling, useVisit } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import {
  Badge,
  Button,
  EmptyState,
  Skeleton,
  buttonClasses,
  cn,
  popupClasses,
  positionerClasses,
} from '../primitives/index.js'

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
        render={<Button type="button" variant="ghost" square />}
        className="relative"
        aria-label={t('Notifications')}
      >
        <Icon name="bell" className="!size-[1.125rem]" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-semibold tabular-nums leading-none text-destructive-foreground ring-2 ring-background">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className={positionerClasses}>
          <Popover.Popup
            data-pupitre-popup=""
            className={cn(popupClasses, 'w-[min(24rem,calc(100vw-2rem))] overflow-hidden p-0')}
            aria-label={t('Notifications')}
          >
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {t('Notifications')}
                {unread > 0 && (
                  <Badge color="primary" size="sm">
                    {unread > 99 ? '99+' : unread}
                  </Badge>
                )}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={!unread}
                onClick={() => void markRead('all')}
              >
                <Icon name="check-check" />
                {t('Mark all read')}
              </Button>
            </header>
            <div
              className="pupitre-scroll max-h-[26rem] overflow-y-auto"
              aria-busy={loading || refreshing}
            >
              {loading && (
                <div className="space-y-4 px-4 py-4">
                  <span className="sr-only">{t('Loading notifications…')}</span>
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex gap-3">
                      <Skeleton className="mt-1 size-2 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-2/3" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!loading && items.length === 0 && (
                <EmptyState
                  icon="bell-off"
                  heading={t('You’re all caught up.')}
                  description={t('New notifications will appear here.')}
                  className="py-10"
                />
              )}
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3.5',
                      !item.readAt && 'bg-primary-soft/40'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        item.readAt ? 'bg-transparent ring-1 ring-inset ring-input' : 'bg-primary'
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      {item.url ? (
                        <a
                          className="rounded-sm text-sm font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
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
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                      )}
                      {item.body && (
                        <p className="mt-0.5 text-[0.8125rem] leading-5 text-muted-foreground">
                          {item.body}
                        </p>
                      )}
                      {(item.actions?.length || !item.readAt) && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {item.actions?.map((action, index) => (
                            <button
                              key={`${action.label}:${index}`}
                              type="button"
                              className={buttonClasses({
                                variant: 'link',
                                color: 'primary',
                                className: 'text-xs',
                              })}
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
                          {!item.readAt && (
                            <button
                              type="button"
                              className={buttonClasses({
                                variant: 'link',
                                color: 'gray',
                                className: 'text-xs',
                              })}
                              onClick={() => void markRead([item.id])}
                            >
                              {t('Mark read')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
