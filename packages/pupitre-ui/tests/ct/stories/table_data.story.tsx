import { useEffect } from 'react'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import { defineRegistry, PupitreRenderer, setRouter } from '@rikology/pupitre-react'
import { components } from '../../../src/components.js'

const registry = defineRegistry(components)
const draft = {
  key: 10,
  cells: { title: 'Draft memo', viewsCount: '10' },
  actions: [],
  selectable: true,
}
const published = {
  key: 11,
  cells: { title: 'Published report', viewsCount: '20' },
  actions: [],
  selectable: true,
}
const page = {
  key: 'ct:table-data',
  kind: 'custom',
  title: 'Table data',
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
            id: 'table-data',
            url: '/posts',
            columns: [
              {
                name: 'title',
                label: 'Title',
                type: 'text',
                sortable: false,
                searchable: false,
                individuallySearchable: true,
                props: {},
              },
              {
                name: 'viewsCount',
                label: 'Views',
                type: 'text',
                sortable: false,
                searchable: false,
                summarize: ['sum'],
                props: { numeric: true },
              },
            ],
            filters: [],
            filtersLayout: 'above',
            groups: [{ key: 'status', label: 'Status', collapsible: true }],
            perPageOptions: [10],
            searchable: false,
            searchDebounce: 0,
            selectable: false,
            striped: false,
            bulkActions: [],
            layout: 'table',
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
      reload: () => {},
      visit: (url: string) => {
        const visits = (window as Window & { __tableDataVisits?: string[] }).__tableDataVisits ?? []
        visits.push(url)
        ;(window as Window & { __tableDataVisits?: string[] }).__tableDataVisits = visits
      },
      get: () => {},
      post: () => {},
      put: () => {},
      patch: () => {},
      delete: () => {},
      on: () => () => {},
    } as never)
    return () => restoreRouter()
  }, [])
  return null
}

export function TableDataStory() {
  return (
    <>
      <PupitreRenderer
        page={page}
        data={{
          rows: [draft, published],
          meta: { total: 2, perPage: 10, currentPage: 1, lastPage: 1, from: 1, to: 2 },
          summary: { viewsCount: { sum: 30 } },
          groups: [
            {
              key: 'draft',
              label: 'Status: draft',
              rows: [draft],
              summary: { viewsCount: { sum: 10 } },
            },
            {
              key: 'published',
              label: 'Status: published',
              rows: [published],
              summary: { viewsCount: { sum: 20 } },
            },
          ],
          query: { groupBy: 'status' },
        }}
        pupitre={props}
        registry={registry}
        upload={async () => ({})}
        runAction={async () => {}}
        toast={() => {}}
      />
      <RouterHarness />
    </>
  )
}
