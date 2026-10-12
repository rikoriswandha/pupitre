import { useLayoutEffect } from 'react'
import type { PupitrePageProps, TableDescriptor } from '@rikology/pupitre/catalog'
import { defineRegistry, PupitreRenderer, setFetch, setRouter } from '@rikology/pupitre-react'
import { components } from '../../../src/components.js'

const registry = defineRegistry(components)
const page = {
  key: 'ct:table-interact',
  kind: 'custom',
  title: 'Table interactions',
  breadcrumbs: [],
  catalogVersion: '1.0',
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

function RouterHarness({ deferred = false }: { deferred?: boolean }) {
  useLayoutEffect(() => {
    const listeners = new Map<string, Set<(event: unknown) => unknown>>()
    const fire = (name: string, detail: unknown) => {
      const event = new CustomEvent(name, { detail, cancelable: name === 'before' })
      listeners.get(name)?.forEach((listener) => {
        if (listener(event) === false) event.preventDefault()
      })
      return !event.defaultPrevented
    }
    let visitId = 0
    ;(
      window as Window & { __tableRefresh?: (title?: string, id?: number) => number }
    ).__tableRefresh = (title, requestId = visitId) => {
      if (title === undefined) {
        const id = ++visitId
        const visit = { id, method: 'get', only: ['data'] }
        if (fire('before', { visit })) fire('start', { visit })
        return id
      }
      fire('success', {
        visitId: requestId,
        page: { props: { data: { rows: [{ key: 10, cells: { title: { value: title } } }] } } },
      })
      return requestId
    }
    ;(window as Window & { __cancelTableRefresh?: () => void }).__cancelTableRefresh = () => {
      const cancel = () => false
      const callbacks = listeners.get('before') ?? new Set()
      callbacks.add(cancel)
      listeners.set('before', callbacks)
      ;(window as Window & { __tableRefresh?: () => number }).__tableRefresh!()
      callbacks.delete(cancel)
    }
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
      on: (name: string, listener: (event: unknown) => void) => {
        const callbacks = listeners.get(name) ?? new Set()
        callbacks.add(listener)
        listeners.set(name, callbacks)
        return () => callbacks.delete(listener)
      },
    } as never)
    const restoreFetch = setFetch(async (_input, init) => {
      const calls = (window as Window & { __tableRequests?: unknown[] }).__tableRequests ?? []
      calls.push({ method: init?.method, body: init?.body })
      ;(window as Window & { __tableRequests?: unknown[] }).__tableRequests = calls
      const value = JSON.parse(String(init?.body)).value
      if (deferred && init?.method === 'PATCH') {
        const response = Promise.withResolvers<Response>()
        ;(window as Window & { __settleTableEdit?: (success: boolean) => void }).__settleTableEdit =
          (success) => response.resolve(new Response(null, { status: success ? 204 : 422 }))
        return response.promise
      }
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
  }, [deferred])
  return <pre data-testid="table-reloads">[]</pre>
}

export function TableInteractStory({
  pageTwo = false,
  freshTitle = 'Hello',
  deferred = false,
  selectable = false,
  layout = 'grid',
  density = 'comfortable',
  textOnly = false,
  controlType = 'toggle',
}: {
  pageTwo?: boolean
  freshTitle?: string
  deferred?: boolean
  selectable?: boolean
  layout?: 'table' | 'grid'
  density?: 'compact' | 'comfortable'
  textOnly?: boolean
  controlType?: 'toggle' | 'checkbox'
}) {
  return (
    <div data-density={density}>
      <PupitreRenderer
        page={{
          ...page,
          spec: {
            ...page.spec,
            elements: {
              ...page.spec.elements,
              table: {
                ...page.spec.elements.table,
                props: {
                  ...page.spec.elements.table.props,
                  descriptor: {
                    ...(page.spec.elements.table.props.descriptor as TableDescriptor),
                    id: 'table-interact',
                    selectable,
                    layout,
                    columns: textOnly
                      ? [
                          {
                            name: 'title',
                            label: 'Title',
                            type: 'text',
                            sortable: false,
                            searchable: false,
                            props: {},
                          },
                          {
                            name: 'isFeatured',
                            label: 'Featured',
                            type: controlType,
                            sortable: false,
                            searchable: false,
                            editable: { url: '/posts/:id/column/isFeatured' },
                            props: {},
                          },
                        ]
                      : (page.spec.elements.table.props.descriptor as TableDescriptor).columns,
                  },
                },
              },
            },
          },
        }}
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
      <RouterHarness deferred={deferred} />
    </div>
  )
}
