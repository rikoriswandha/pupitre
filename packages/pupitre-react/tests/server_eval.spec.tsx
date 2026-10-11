import { test } from '@japa/runner'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { PupitreRenderer } from '../src/renderer/PupitreRenderer.js'
import { defineRegistry } from '../src/registry/defineRegistry.js'
import { setFetch } from '../src/bridge/actions.js'
import type { StateStore } from '@json-render/core'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import type { ReactNode } from 'react'

function RegistryForm({ children }: { children?: ReactNode }) {
  return <form>{children}</form>
}
const registry = defineRegistry({
  Shell: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Toaster: () => null,
  Modal: () => null,
  ConfirmDialog: () => null,
  Text: () => <input />,
  Form: RegistryForm,
} as never)

const basePage = {
  key: 'admin:posts:create::',
  kind: 'create',
  title: 'Create',
  breadcrumbs: [],
  spec: {
    root: 'title',
    elements: {
      title: {
        type: 'Text',
        props: { name: 'title' },
        watch: {
          value: [
            {
              action: 'evaluate',
              params: { url: '/_pupitre/evaluate', resource: 'posts', field: 'title', debounce: 0 },
            },
          ],
        },
      },
    },
  },
  state: { data: { title: '', slug: '' }, meta: {}, errors: {} },
  actions: { header: [] },
  catalogVersion: '1.0',
} as unknown as PupitrePageProps['page']

const pupitre = {
  panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
  user: null,
  tenant: null,
  nav: [],
  flash: [],
  locale: 'en',
  timezone: 'UTC',
} as unknown as PupitrePageProps['pupitre']

test('server evaluation ignores stale responses and preserves user-edited target paths', async ({
  assert,
}) => {
  const dom = new Window()
  Object.assign(globalThis, { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true })
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  const requests: Array<(response: Response) => void> = []
  const restoreFetch = setFetch(() => {
    const pending = Promise.withResolvers<Response>()
    requests.push(pending.resolve)
    return pending.promise
  })
  let store: StateStore | undefined
  try {
    await act(async () => {
      root.render(
        <PupitreRenderer
          page={basePage}
          pupitre={pupitre}
          registry={registry}
          runAction={async () => {}}
          upload={async () => {}}
          toast={() => {}}
          onStore={(value) => {
            store = value
          }}
        />
      )
    })
    assert.exists(store)
    await act(async () => {
      store!.set('/data/title', 'first')
    })
    const firstDelay = Promise.withResolvers<void>()
    setTimeout(firstDelay.resolve, 10)
    await firstDelay.promise
    await act(async () => {
      store!.set('/data/title', 'second')
    })
    const secondDelay = Promise.withResolvers<void>()
    setTimeout(secondDelay.resolve, 10)
    await secondDelay.promise
    assert.equal(requests.length, 2)

    const json = (set: Record<string, unknown>) =>
      new Response(JSON.stringify({ set }), { status: 200 })
    await act(async () => {
      requests[1]!(json({ '/data/slug': 'server-second' }))
      await Promise.resolve()
    })
    assert.equal(store!.get('/data/slug'), 'server-second')

    await act(async () => {
      store!.set('/data/slug', 'typed-by-user')
    })
    await act(async () => {
      requests[0]!(json({ '/data/slug': 'stale-first' }))
      await Promise.resolve()
    })
    assert.equal(store!.get('/data/slug'), 'typed-by-user')
    await act(async () => {
      store!.set('/data/title', 'third')
    })
    const thirdDelay = Promise.withResolvers<void>()
    setTimeout(thirdDelay.resolve, 10)
    await thirdDelay.promise
    assert.equal(requests.length, 3)
    await act(async () => {
      store!.set('/data/slug', 'typed-before-response')
    })
    await act(async () => {
      requests[2]!(json({ '/data/slug': 'server-third' }))
      await Promise.resolve()
    })
    assert.equal(store!.get('/data/slug'), 'typed-before-response')
  } finally {
    restoreFetch()
    await act(async () => root.unmount())
    dom.happyDOM.abort()
  }
})
