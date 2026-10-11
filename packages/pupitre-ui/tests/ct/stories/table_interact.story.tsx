import { useEffect } from 'react'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import { defineRegistry, PupitreRenderer, setFetch, setRouter } from '@rikology/pupitre-react'
import { components } from '../../../src/components.js'

const registry = defineRegistry(components)
const page = {
  key: 'ct:table-interact',
  kind: 'custom',
  title: 'Table interactions',
  breadcrumbs: [],
  catalogVersion: '0.3',
  actions: { header: [] },
  state: {},
  spec: {
    root: 'table',
    elements: {
      table: {
        type: 'DataTable',
        props: {
          descriptor: {
            id: 'table-interact',
            url: '/posts',
            columns: [
              {
                name: 'title',
                label: 'Title',
                type: 'textInput',
                sortable: false,
                searchable: false,
                editable: { url: '/posts/:id/column/title' },
                props: {},
              },
              {
                name: 'isFeatured',
                label: 'Featured',
                type: 'toggle',
                sortable: false,
                searchable: false,
                toggleable: { hiddenByDefault: true },
                editable: { url: '/posts/:id/column/isFeatured' },
                props: {},
              },
            ],
            filters: [
              {
                type: 'select',
                name: 'status',
                label: 'Status',
                options: [{ value: 'draft', label: 'Draft' }],
              },
            ],
            filtersLayout: 'above',
            perPageOptions: [10],
            searchable: false,
            searchDebounce: 0,
            poll: 30,
            deferFilters: true,
            selectable: false,
            bulkActions: [],
            reorderable: { url: '/posts/reorder' },
            layout: 'grid',
            gridColumns: { default: 1, md: 2, xl: 3 },
          },
        },
      },
    },
  },
} as unknown as PupitrePageProps['page']
const props: PupitrePageProps['pupitre'] = {
  panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
  user: null,
  tenant: null,
  nav: [],
  flash: [],
  locale: 'en',
  timezone: 'UTC',
}

function RouterHarness() {
  useEffect(() => {
    const restoreRouter = setRouter({
      reload: (options?: unknown) => {
        const calls = (window as Window & { __tableReloads?: unknown[] }).__tableReloads ?? []
        calls.push(options)
        ;(window as Window & { __tableReloads?: unknown[] }).__tableReloads = calls
      },
      visit: (url: string, options?: unknown) => {
        const calls = (window as Window & { __tableVisits?: unknown[] }).__tableVisits ?? []
        calls.push({ url, options })
        ;(window as Window & { __tableVisits?: unknown[] }).__tableVisits = calls
      },
      get: () => {},
      post: () => {},
      put: () => {},
      patch: () => {},
      delete: () => {},
      on: () => () => {},
    } as never)
    const restoreFetch = setFetch(async (_input, init) => {
      const calls = (window as Window & { __tableRequests?: unknown[] }).__tableRequests ?? []
      calls.push({ method: init?.method, body: init?.body })
      ;(window as Window & { __tableRequests?: unknown[] }).__tableRequests = calls
      const value = JSON.parse(String(init?.body)).value
      if (init?.method === 'PATCH' && typeof value === 'string' && value !== 'invalid') {
        const { promise, resolve } = Promise.withResolvers<void>()
        setTimeout(resolve, 150)
        await promise
      }
      if (init?.method === 'PATCH' && (value === 'invalid' || value === false))
        return new Response(JSON.stringify({ errors: { value: ['Invalid'] } }), { status: 422 })
      return new Response(null, { status: 204 })
    })
    return () => {
      restoreFetch()
      restoreRouter()
    }
  }, [])
  return <pre data-testid="table-reloads">[]</pre>
}

export function TableInteractStory({
  pageTwo = false,
  freshTitle = 'Hello',
}: {
  pageTwo?: boolean
  freshTitle?: string
}) {
  return (
    <>
      <PupitreRenderer
        page={page}
        data={{
          rows: [
            {
              key: 10,
              cells: {
                title: { value: freshTitle, display: freshTitle },
                isFeatured: { value: false, display: 'Off' },
              },
              actions: [],
              selectable: true,
            },
            {
              key: 11,
              cells: {
                title: { value: 'Second', display: 'Second' },
                isFeatured: { value: false, display: 'Off' },
              },
              actions: [],
              selectable: true,
            },
          ],
          meta: {
            total: 2,
            perPage: pageTwo ? 1 : 10,
            currentPage: pageTwo ? 2 : 1,
            lastPage: 2,
            from: pageTwo ? 2 : 1,
            to: pageTwo ? 2 : 2,
          },
        }}
        pupitre={props}
        registry={registry}
        upload={async () => ({})}
        runAction={async () => {}}
        toast={(message) => {
          const toasts = (window as Window & { __tableToasts?: unknown[] }).__tableToasts ?? []
          toasts.push(message)
          ;(window as Window & { __tableToasts?: unknown[] }).__tableToasts = toasts
        }}
      />
      <RouterHarness />
    </>
  )
}
