import { useEffect, useState } from 'react'
import { setRouter } from '@rikology/pupitre-react'
import { NotificationTray } from '../../../src/components/NotificationTray.js'

type RequestLog = { method: string; url: string; body: string | null; xsrf: string | null }

export function NotificationTrayStory() {
  const [requests, setRequests] = useState<RequestLog[]>([])
  useEffect(() => {
    const originalFetch = window.fetch
    const originalXsrf = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('XSRF-TOKEN='))
      ?.slice('XSRF-TOKEN='.length)
    document.cookie = 'XSRF-TOKEN=ct-token; Path=/'
    window.fetch = async (input, init) => {
      const url = String(input)
      const headers = new Headers(init?.headers)
      setRequests((previous) => [
        ...previous,
        {
          method: init?.method ?? 'GET',
          url,
          body: typeof init?.body === 'string' ? init.body : null,
          xsrf: headers.get('X-XSRF-TOKEN'),
        },
      ])
      if (url.includes('/read')) return new Response(null, { status: 204 })
      return new Response(
        JSON.stringify({
          items: [
            {
              id: 'notification-1',
              type: 'success',
              title: 'Post published',
              body: 'Field Notes 03 is live',
              url: '/admin/posts/3',
              readAt: null,
              actions: [{ label: 'Mark as read from action', markAsRead: true }],
              createdAt: '2026-10-11T00:00:00.000Z',
            },
          ],
          unread: 1,
          meta: { total: 1, perPage: 20, currentPage: 1, lastPage: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }
    const restoreRouter = setRouter({
      visit: () => {},
      reload: () => {},
      put: () => {},
      post: () => {},
      on: () => () => {},
    } as never)
    return () => {
      window.fetch = originalFetch
      restoreRouter()
      document.cookie = originalXsrf
        ? `XSRF-TOKEN=${originalXsrf}; Path=/`
        : 'XSRF-TOKEN=; Max-Age=0; Path=/'
    }
  }, [])
  return (
    <div className="p-8">
      <NotificationTray
        notifications={{
          unread: 1,
          url: '/admin/_pupitre/notifications',
          readUrl: '/admin/_pupitre/notifications/read',
          interval: 30_000,
        }}
      />
      <output data-testid="notification-requests">{JSON.stringify(requests)}</output>
    </div>
  )
}
