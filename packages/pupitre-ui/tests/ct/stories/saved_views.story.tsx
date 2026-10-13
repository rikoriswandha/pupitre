import { useLayoutEffect, useState } from 'react'
import type { TableDescriptor } from '@rikology/pupitre/catalog'
import { setFetch, setRouter } from '@rikology/pupitre-react'
import { DataTableViews } from '../../../src/components/DataTableViews.js'

const descriptor = {
  id: 'posts',
  url: '/posts',
  columns: [
    {
      name: 'title',
      toggleable: { hiddenByDefault: false },
      type: 'text',
      label: 'Title',
      sortable: true,
      searchable: true,
      props: {},
    },
  ],
  filters: [],
  filtersLayout: 'dropdown',
  perPageOptions: [25],
  searchable: true,
  searchDebounce: 0,
  selectable: false,
  bulkActions: [],
  layout: 'table',
  views: {
    url: '/posts/views',
    enabled: true,
    canManagePublic: true,
    items: [
      {
        id: 'preset:0',
        name: 'Drafts',
        source: 'preset',
        editable: false,
        isPublic: false,
        isDefault: false,
        query: { filters: { status: 'draft' } },
        columns: { title: false },
      },
    ],
  },
} satisfies TableDescriptor
export function SavedViewsStory({ prefix = false }: { prefix?: boolean }) {
  const [url, setUrl] = useState('')
  const [columns, setColumns] = useState<Record<string, boolean>>({ title: true })
  const [request, setRequest] = useState('')
  useLayoutEffect(() => {
    window.history.replaceState({}, '', `${window.location.pathname}?q=outer&comments[page]=2`)
    const restoreRouter = setRouter({
      visit: (next: string) => {
        window.history.replaceState({}, '', next)
        setUrl(next)
      },
      on: () => () => {},
    } as never)
    const restoreFetch = setFetch(async (input, init) => {
      setRequest(
        JSON.stringify({
          url: String(input),
          method: init?.method,
          body: init?.body ? JSON.parse(String(init.body)) : null,
        })
      )
      if (init?.method === 'DELETE') return new Response(null, { status: 204 })
      const payload = JSON.parse(String(init?.body))
      return Response.json({ ...payload, id: 'saved:1', source: 'mine', editable: true })
    })
    return () => {
      restoreRouter()
      restoreFetch()
    }
  }, [])
  return (
    <main className="p-8">
      <DataTableViews
        descriptor={{ ...descriptor, ...(prefix ? { queryPrefix: 'comments' } : {}) }}
        query={{ q: 'hello', sort: 'title', perPage: 25 }}
        columns={columns}
        onColumns={setColumns}
      />
      <output aria-label="Visited URL">{url}</output>
      <output aria-label="View request">{request}</output>
      <output aria-label="Visible columns">{JSON.stringify(columns)}</output>
    </main>
  )
}
