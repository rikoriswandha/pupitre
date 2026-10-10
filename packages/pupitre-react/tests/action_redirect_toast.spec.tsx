import { test } from '@japa/runner'
import { act } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import type { ActionResult, PupitrePageProps } from '@rikology/pupitre/catalog'
import { defineRegistry } from '../src/registry/defineRegistry.js'
import { handleActionResult } from '../src/bridge/actions.js'
import { setRouter } from '../src/bridge/inertia.js'
import type { RouterLike } from '../src/bridge/inertia.js'
import { PupitreContent } from '../src/page/Pupitre.js'
import type { ToastMessage } from '../src/shell/types.js'

function installDom() {
  const dom = new Window({ url: 'http://localhost/admin/posts/1/edit' })
  const global = globalThis as unknown as Record<string, unknown>
  const previous = new Map<string, unknown>()
  for (const [key, value] of Object.entries({
    window: dom,
    document: dom.document,
    navigator: dom.navigator,
    Node: dom.Node,
    Element: dom.Element,
    HTMLElement: dom.HTMLElement,
    MutationObserver: dom.MutationObserver,
    Event: dom.Event,
    MouseEvent: dom.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, global[key])
    Object.defineProperty(global, key, { configurable: true, writable: true, value })
  }
  return {
    dom,
    restore() {
      for (const [key, value] of previous) {
        if (value === undefined) delete global[key]
        else Object.defineProperty(global, key, { configurable: true, writable: true, value })
      }
    },
  }
}

const registry = defineRegistry({
  Shell: ({ children }: { children: ReactNode }) => <>{children}</>,
  Toaster: ({ toasts }: { toasts: ToastMessage[] }) => (
    <div data-testid="toaster">
      {toasts.map((toast) => (
        <div key={toast.id} role="status" data-toast-id={toast.id}>
          {toast.title}
        </div>
      ))}
    </div>
  ),
  NotFound: () => null,
  ConfirmDialog: () => null,
} as never)

const pupitre = {
  panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
  user: null,
  tenant: null,
  nav: [],
  flash: [],
  locale: 'en',
  timezone: 'UTC',
} as unknown as PupitrePageProps['pupitre']

function pageProps(key: string) {
  return {
    page: {
      key,
      kind: 'list',
      title: 'Posts',
      breadcrumbs: [],
      catalogVersion: '0.1',
      actions: { header: [] },
    },
    data: {},
    pupitre,
  } as unknown as PupitrePageProps
}

test('redirecting ActionResult flash appears once after the page changes', async ({ assert }) => {
  const { dom, restore } = installDom()
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  const visits: string[] = []
  const restoreRouter = setRouter({
    visit: (url: string) => visits.push(url),
  } as unknown as RouterLike)

  try {
    await act(async () =>
      root.render(<PupitreContent registry={registry} props={pageProps('edit')} />)
    )
    await act(async () =>
      handleActionResult(
        {
          flash: [{ type: 'success', title: 'Deleted' }],
          redirect: '/admin/posts',
        } as ActionResult,
        {
          data: {},
          pageKind: 'edit',
          toast: () => assert.fail('redirect toast was shown before navigation'),
          setData: () => {},
        }
      )
    )
    assert.deepEqual(visits, ['http://localhost/admin/posts'])

    await act(async () =>
      root.render(<PupitreContent registry={registry} props={pageProps('list')} />)
    )
    assert.equal(container.querySelectorAll('[role="status"][data-toast-id]').length, 1)
    assert.equal(container.querySelector('[role="status"]')?.textContent, 'Deleted')

    await act(async () =>
      root.render(<PupitreContent registry={registry} props={pageProps('list')} />)
    )
    assert.equal(container.querySelectorAll('[role="status"][data-toast-id]').length, 1)
  } finally {
    await act(async () => root.unmount())
    restoreRouter()
    dom.happyDOM.abort()
    restore()
  }
})
