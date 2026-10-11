import { useEffect, useState } from 'react'
import type { RealtimeClient, RealtimeEvent, TableDescriptor } from '@rikology/pupitre/catalog'
import { setRouter } from '@rikology/pupitre-react'
import { RealtimeProvider } from '../../../../pupitre-react/src/hooks/use_realtime.js'
import { DataTable } from '../../../src/components/DataTable.js'
import { NotificationTray } from '../../../src/components/NotificationTray.js'

const descriptor = {
  id: 'realtime-posts',
  url: '/posts',
  dataProp: 'relation_posts',
  realtime: { channel: 'pupitre/admin/resources/posts' },
  poll: 1000,
  columns: [
    { name: 'title', label: 'Title', type: 'text', sortable: false, searchable: false, props: {} },
  ],
  filters: [],
  filtersLayout: 'above',
  perPageOptions: [10],
  searchable: false,
  searchDebounce: 0,
  selectable: false,
  bulkActions: [],
  layout: 'table',
} as TableDescriptor

type State = Window & { __realtimeReloads?: unknown[]; __realtimeClosed?: string[] }

export function RealtimeStory({ enabled = true }: { enabled?: boolean }) {
  const [title, setTitle] = useState('Original post')
  const [client] = useState<RealtimeClient>(() => ({
    subscribe(channel, callback) {
      const listener = (event: Event) => callback((event as CustomEvent<RealtimeEvent>).detail)
      window.addEventListener(channel, listener)
      return () => {
        window.removeEventListener(channel, listener)
        const state = window as State
        ;(state.__realtimeClosed ??= []).push(channel)
      }
    },
  }))
  useEffect(() => {
    const state = window as State
    state.__realtimeReloads = []
    state.__realtimeClosed = []
    return setRouter({
      reload(options: unknown) {
        state.__realtimeReloads?.push(options)
        setTitle('Updated post')
      },
    } as never)
  }, [])
  return (
    <RealtimeProvider client={enabled ? client : undefined} userChannel="pupitre/admin/users/1">
      <NotificationTray
        notifications={{
          unread: 0,
          interval: 1000,
          url: '/notifications',
          readUrl: '/notifications/read',
        }}
      />
      <DataTable
        props={{ descriptor }}
        emit={() => {}}
        tableData={{
          rows: [{ key: 1, cells: { title }, actions: [], selectable: false }],
          meta: { total: 1, perPage: 10, currentPage: 1, lastPage: 1, from: 1, to: 1 },
          query: {},
        }}
      />
    </RealtimeProvider>
  )
}
