import { test } from '@japa/runner'
import { renderToString } from 'react-dom/server'
import { createPupitreStore } from '../src/renderer/store.js'
import { mapErrors } from '../src/bridge/errors.js'
import { setRouter } from '../src/bridge/inertia.js'
import { submitForm } from '../src/bridge/actions.js'
import { Pupitre } from '../src/page/Pupitre.js'
import { RuntimeContext } from '../src/runtime.js'
import { useTable } from '../src/hooks/index.js'
import type { RuntimeContextValue } from '../src/runtime.js'
import type { RouterLike } from '../src/bridge/inertia.js'
import type { PupitrePageProps, TableDescriptor } from '@rikology/pupitre/catalog'

function fakeRouter(calls: Array<{ method: string; args: unknown[] }>): RouterLike {
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args })
    }
  return {
    visit: record('visit'),
    reload: record('reload'),
    get: record('get'),
    post: record('post'),
    put: record('put'),
    patch: record('patch'),
    delete: record('delete'),
  } as unknown as RouterLike
}
const page = {
  key: 'admin:posts:create::',
  kind: 'create',
  title: 'Create',
  breadcrumbs: [],
  spec: {
    root: 'form',
    elements: {
      form: {
        type: 'Form',
        props: { method: 'put', url: '/posts/4', submitLabel: 'Save', dirtyGuard: true },
      },
    },
  },
  state: {},
  actions: { header: [] },
  catalogVersion: '0.1',
} as unknown as PupitrePageProps['page']
const tableDescriptor = {
  id: 'posts',
  url: '/posts',
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

test.group('Pupitre React bridge', () => {
  test('maps nested validation errors without changing form data', ({ assert }) => {
    const runtime = createPupitreStore({ data: { items: [{ sku: 'A' }] }, errors: {} })
    mapErrors(runtime.store, { 'items.0.sku': ['Required', 'Another message'] })
    assert.equal(runtime.store.get('/errors/items/0/sku'), 'Required')
    assert.equal(runtime.store.get('/data/items/0/sku'), 'A')
  })

  test('submits descriptor method and form data through Inertia', ({ assert }) => {
    const calls: Array<{ method: string; args: unknown[] }> = []
    const restoreRouter = setRouter(fakeRouter(calls))
    const runtime = createPupitreStore({ data: { title: 'Draft' }, errors: {} })
    try {
      submitForm(page, runtime.store, () => {})
      assert.equal(calls[0]?.method, 'put')
      assert.equal(calls[0]?.args[0], '/posts/4')
      assert.deepEqual(calls[0]?.args[1], { title: 'Draft' })
      const options = calls[0]?.args[2] as {
        preserveState: boolean
        preserveScroll: boolean
        onError: (errors: Record<string, string>) => void
      }
      assert.isTrue(options.preserveState)
      assert.isTrue(options.preserveScroll)
      options.onError({ 'items.0.sku': 'Invalid SKU' })
      assert.equal(runtime.store.get('/errors/items/0/sku'), 'Invalid SKU')
      assert.equal(runtime.store.get('/data/title'), 'Draft')
    } finally {
      restoreRouter()
    }
  })

  test('writes table filters into the query and reloads only top-level data', ({ assert }) => {
    const calls: Array<{ method: string; args: unknown[] }> = []
    const restoreRouter = setRouter(fakeRouter(calls))
    let controls: ReturnType<typeof useTable> | undefined
    const runtime = {
      store: createPupitreStore({}).store,
      page,
      data: { rows: [], query: {} },
      panel: {},
      functions: {},
      runAction: async () => {},
      submitForm: () => {},
      upload: async () => [],
      toast: () => {},
    } as unknown as RuntimeContextValue
    function Consumer() {
      controls = useTable(tableDescriptor)
      return null
    }
    try {
      renderToString(
        <RuntimeContext.Provider value={runtime}>
          <Consumer />
        </RuntimeContext.Provider>
      )
      controls?.setFilter('status', 'draft')
      assert.equal(calls[0]?.method, 'reload')
      const options = calls[0]?.args[0] as { only: string[]; data: Record<string, unknown> }
      assert.deepEqual(options.only, ['data'])
      assert.equal(options.data['filters[status]'], 'draft')
    } finally {
      restoreRouter()
    }
  })

  test('renders the Pupitre page without touching browser globals on the server', ({ assert }) => {
    assert.doesNotThrow(() => renderToString(<Pupitre registry={{} as never} />))
  })
})
