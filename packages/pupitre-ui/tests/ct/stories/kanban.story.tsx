import { useEffect, useState } from 'react'
import { setFetch } from '@rikology/pupitre-react'
import { PageActionsContext } from '../../../../pupitre-react/src/runtime.js'
import { KanbanBoard } from '../../../src/components/KanbanBoard.js'
import type { KanbanData } from '../../../src/components/KanbanBoard.js'

const initial: KanbanData = {
  statusColumn: 'status',
  columns: [
    {
      value: 'draft',
      label: 'Draft',
      count: 1,
      limit: 25,
      cards: [{ id: '1', title: 'First card', movable: true, entries: [] }],
    },
    { value: 'published', label: 'Published', count: 0, limit: 25, cards: [] },
  ],
}
const descriptor = {
  name: 'board',
  kind: 'component' as const,
  component: 'KanbanBoard',
  dataProp: 'board',
  dataUrl: '/board',
  span: 'full' as const,
  sort: 0,
}
export function KanbanStory({
  fail = false,
  failureStatus = 403,
  reloadFailure = false,
}: {
  fail?: boolean
  failureStatus?: 403 | 422
  reloadFailure?: boolean
}) {
  const [message, setMessage] = useState('')
  useEffect(() => {
    let saved = initial
    setFetch(async (_url, request) => {
      if (request?.method === 'POST') {
        if (fail)
          return new Response(JSON.stringify({ message: 'Move rejected' }), {
            status: failureStatus,
          })
        const { data } = JSON.parse(String(request.body)) as { data: { status: string } }
        saved = {
          ...initial,
          columns: initial.columns.map((column) => ({
            ...column,
            cards: column.value === data.status ? initial.columns[0].cards : [],
            count: column.value === data.status ? 1 : 0,
          })),
        }
        return new Response(JSON.stringify({ flash: [] }), { status: 200 })
      }
      if (reloadFailure)
        return new Response(JSON.stringify({ message: 'Reload failed' }), { status: 500 })
      return new Response(JSON.stringify({ kind: 'component', data: saved }))
    })
    return () => {
      setFetch(fetch)
    }
  }, [fail, failureStatus, reloadFailure])
  return (
    <PageActionsContext.Provider
      value={{ toast: (notification) => setMessage(notification.title), runAction: async () => {} }}
    >
      <main>
        <KanbanBoard descriptor={descriptor} data={initial} />
        <p role="alert">{message}</p>
      </main>
    </PageActionsContext.Provider>
  )
}
