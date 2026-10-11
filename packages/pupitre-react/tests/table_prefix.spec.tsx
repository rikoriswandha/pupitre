import { test } from '@japa/runner'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createPupitreStore } from '../src/renderer/store.js'
import { useTable } from '../src/hooks/index.js'
import { RuntimeContext } from '../src/runtime.js'
import { setRouter } from '../src/bridge/inertia.js'
import type { RouterLike } from '../src/bridge/inertia.js'
import type { RuntimeContextValue } from '../src/runtime.js'
import type { TableDescriptor } from '@rikology/pupitre/catalog'

type TableControls = {
  data: unknown
  query: Record<string, unknown>
  setQuery(partial: Record<string, unknown>): void
}

test.group('prefixed table hooks', () => {
  test('reads namespaced state and reloads only its table prop', async ({ assert }) => {
    const calls: unknown[][] = []
    const router = {
      visit: (...args: unknown[]) => calls.push(args),
    } as unknown as RouterLike
    const restoreRouter = setRouter(router)
    const location = globalThis.window as unknown as { happyDOM: { setURL(url: string): void } }
    location.happyDOM.setURL(
      'http://localhost/admin/posts/1?comments%5Bsort%5D=-createdAt&comments%5Bfilters%5D%5Bapproved%5D=true'
    )
    const tableData = { rows: ['comments'] }
    const runtime = {
      store: createPupitreStore({}).store,
      page: {} as never,
      data: undefined,
      tableDataProps: { commentsData: tableData },
      panel: {},
      functions: {},
      runAction: async () => {},
      submitForm: () => {},
      upload: async () => [],
      toast: () => {},
    } as unknown as RuntimeContextValue
    const descriptor = {
      id: 'comments',
      url: '/admin/posts/1/relations/comments',
      dataProp: 'commentsData',
      queryPrefix: 'comments',
      columns: [],
      filters: [],
      filtersLayout: 'above',
      perPageOptions: [10],
      searchable: true,
      searchDebounce: 100,
      selectable: false,
      bulkActions: [],
      layout: 'table',
    } as unknown as TableDescriptor
    let controls: TableControls | undefined
    const container = document.createElement('div')
    const root = createRoot(container)
    function Consumer() {
      controls = useTable(descriptor)
      return (
        <output>
          {String(controls.data === tableData)}:{String(controls.query.sort)}:
          {String(controls.query['filters[approved]'])}
        </output>
      )
    }
    try {
      await act(async () =>
        root.render(
          <RuntimeContext.Provider value={runtime}>
            <Consumer />
          </RuntimeContext.Provider>
        )
      )
      assert.equal(container.textContent, 'true:-createdAt:true')
      await act(async () =>
        controls?.setQuery({ 'sort': 'createdAt', 'filters[approved]': 'false', 'page': 1 })
      )
      const [url, options] = calls[0] as [string, { only: string[] }]
      const visited = new URL(url, 'http://localhost')
      assert.equal(visited.searchParams.get('comments[sort]'), 'createdAt')
      assert.equal(visited.searchParams.get('comments[filters][approved]'), 'false')
      assert.deepEqual(options.only, ['commentsData'])
    } finally {
      await act(async () => root.unmount())
      restoreRouter()
      location.happyDOM.setURL('about:blank')
    }
  })
})
