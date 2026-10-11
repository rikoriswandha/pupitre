import { useEffect } from 'react'
import type { WidgetData, WidgetDescriptor } from '@rikology/pupitre/catalog'
import { setRouter } from '@rikology/pupitre-react'
import { WidgetGrid } from '../../../src/components/WidgetGrid.js'

const tableDescriptor: WidgetDescriptor = {
  name: 'latest-posts',
  kind: 'table',
  dataProp: 'widget_dashboard_latest_posts',
  dataUrl: '/admin/_pupitre/widgets/latest-posts',
  heading: 'Latest posts',
  span: 1,
  sort: 0,
  poll: 80,
  table: {
    id: 'admin.widget.latest-posts',
    url: '/admin',
    dataProp: 'widget_dashboard_latest_posts',
    queryPrefix: 'latest-posts',
    columns: [
      {
        name: 'title',
        label: 'Title',
        type: 'text',
        sortable: true,
        searchable: false,
        props: {},
      },
    ],
    filters: [],
    filtersLayout: 'dropdown',
    perPageOptions: [10],
    searchable: false,
    searchDebounce: 300,
    selectable: false,
    bulkActions: [],
    layout: 'table',
  },
}
const widgets: WidgetDescriptor[] = [
  {
    name: 'revenue',
    kind: 'stats',
    dataProp: 'widget_dashboard_revenue',
    heading: 'Revenue',
    span: 1,
    sort: 0,
  },
  {
    name: 'monthly-posts',
    kind: 'chart',
    dataProp: 'widget_dashboard_monthly_posts',
    heading: 'Monthly posts',
    chartType: 'bar',
    span: 3,
    sort: 1,
  },
  tableDescriptor,
]
const data: Record<string, WidgetData> = {
  widget_dashboard_revenue: {
    kind: 'stats',
    stats: [
      {
        label: 'This month',
        value: 1280,
        color: '#167a72',
        description: 'Compared with last month',
        descriptionIcon: 'activity',
        chart: [2, 5, 4, 8],
      },
    ],
  },
  widget_dashboard_monthly_posts: {
    kind: 'chart',
    labels: ['Jan', 'Feb'],
    datasets: [{ label: 'Posts', data: [2, 5] }],
  },
  widget_dashboard_latest_posts: {
    kind: 'table',
    data: {
      rows: [
        {
          key: 1,
          cells: { title: 'First post' },
          actions: [],
          selectable: false,
        },
      ],
      meta: { total: 1, perPage: 10, currentPage: 1, lastPage: 1, from: 1, to: 1 },
      query: { page: 1, perPage: 10 },
    },
  },
}

function RouterHarness() {
  useEffect(() => {
    const originalFetch = window.fetch
    window.fetch = async (input) => {
      const calls = (window as Window & { __widgetRequests?: string[] }).__widgetRequests ?? []
      calls.push(String(input))
      ;(window as Window & { __widgetRequests?: string[] }).__widgetRequests = calls
      return new Response(JSON.stringify(data.widget_dashboard_latest_posts), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const restore = setRouter({
      reload: (options?: unknown) => {
        const calls = (window as Window & { __widgetReloads?: unknown[] }).__widgetReloads ?? []
        calls.push(options)
        ;(window as Window & { __widgetReloads?: unknown[] }).__widgetReloads = calls
      },
      visit: (url: string, options?: unknown) => {
        const calls = (window as Window & { __widgetVisits?: unknown[] }).__widgetVisits ?? []
        calls.push({ url, options })
        ;(window as Window & { __widgetVisits?: unknown[] }).__widgetVisits = calls
      },
      get: () => {},
      post: () => {},
      put: () => {},
      patch: () => {},
      delete: () => {},
      on: () => () => {},
    } as never)
    return () => {
      window.fetch = originalFetch
      restore()
    }
  }, [])
  return null
}

export function WidgetsStory() {
  return (
    <>
      <WidgetGrid
        widgets={widgets}
        data={data}
        filters={[
          { name: 'status', label: 'Status', options: [{ value: 'draft', label: 'Draft' }] },
        ]}
      />
      <RouterHarness />
    </>
  )
}
