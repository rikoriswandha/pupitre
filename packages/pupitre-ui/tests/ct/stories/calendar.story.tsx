import { useLayoutEffect, useState } from 'react'
import { setFetch } from '@rikology/pupitre-react'
import { Calendar } from '../../../src/components/Calendar.js'
import type { CalendarData } from '../../../src/components/CalendarBody.js'
const descriptor = {
  name: 'calendar',
  kind: 'component' as const,
  dataProp: 'calendar',
  dataUrl: '/calendar-data',
  component: 'Calendar',
  heading: 'Publication calendar',
  span: 'full' as const,
  sort: 0,
  placement: 'header' as const,
}
export function CalendarStory({
  failure = false,
  dark = false,
  intervals = false,
  reloadFailure = false,
}: {
  failure?: false | 403 | 422
  dark?: boolean
  intervals?: boolean
  reloadFailure?: boolean
}) {
  const [ready, setReady] = useState(false)
  const [requests, setRequests] = useState('')
  const [rangeRequest, setRangeRequest] = useState('')
  const [initialData] = useState(() => {
    const today = new Date().toISOString().slice(0, 10)
    const data: CalendarData = {
      events: [{ id: 'one', title: 'Launch', start: `${today}T09:00:00Z`, editable: true }],
      ...(intervals
        ? {
            events: [
              {
                id: 'long',
                title: 'Long meeting',
                start: `${today}T09:00:00Z`,
                end: `${today}T12:00:00Z`,
              },
              {
                id: 'overnight',
                title: 'Overnight',
                start: `${today}T22:00:00Z`,
                end: `${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}T02:00:00Z`,
              },
              {
                id: 'multi',
                title: 'Three days',
                start: `${today}T15:00:00Z`,
                end: `${new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)}T10:00:00Z`,
                editable: true,
              },
            ],
          }
        : {}),
      views: ['month', 'week', 'day', 'list'],
      initialView: 'month',
      firstDayOfWeek: 1,
      timezone: 'UTC',
      editable: true,
    }
    return data
  })
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    const data = { ...initialData, events: [...initialData.events] }
    let failReload = false
    let committed = false
    const reset = setFetch(async (_input, init) => {
      if (init?.method === 'POST') {
        setRequests(String(init.body))
        if (failure)
          return new Response(
            JSON.stringify({
              message: 'Rejected move',
              errors: failure === 422 ? { start: ['Invalid date'] } : {},
            }),
            { status: failure }
          )
        const payload = JSON.parse(String(init.body))
        const index = data.events.findIndex((event) => String(event.id) === payload.data.id)
        data.events[index] = {
          ...data.events[index],
          start: `${payload.data.start}Z`,
          end: payload.data.end ? `${payload.data.end}Z` : undefined,
        }
        failReload = reloadFailure
        committed = true
        return new Response(JSON.stringify({ flash: [] }))
      }
      setRangeRequest(String(_input))
      if (failReload) {
        failReload = false
        return Response.json({}, { status: 500 })
      }
      if (reloadFailure && committed)
        data.events = [
          {
            id: 'fresh',
            title: 'Fresh period',
            start: `${new URL(String(_input), 'http://localhost').searchParams.get('start')}Z`,
          },
        ]
      return new Response(
        JSON.stringify({ kind: 'component', data: { ...data, events: [...data.events] } })
      )
    })
    queueMicrotask(() => setReady(true))
    return () => {
      reset()
      document.documentElement.classList.remove('dark')
    }
  }, [failure, dark, initialData, reloadFailure])
  return (
    <main>
      {ready && <Calendar descriptor={descriptor} data={initialData} />}
      <output data-testid="calendar-request">{requests}</output>
      <output data-testid="calendar-range-request">{rangeRequest}</output>
    </main>
  )
}
