import { test } from '@japa/runner'
import { mock } from 'node:test'
import { act } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import type { ActionResult, PupitrePageProps } from '@rikology/pupitre/catalog'
import { defineRegistry } from '../src/registry/defineRegistry.js'
import { handleActionResult, takePendingActionToasts } from '../src/bridge/actions.js'
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
  Toaster: ({ toasts, dismiss }: { toasts: ToastMessage[]; dismiss: (id: string) => void }) => (
    <div data-testid="toaster">
      {toasts.map((toast) => (
        <div key={toast.id} role="status" data-toast-id={toast.id}>
          {toast.title}
          <button onClick={() => dismiss(toast.id)}>Dismiss {toast.title}</button>
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

function pageProps(key: string, url = '/admin/posts') {
  return {
    page: {
      key,
      url,
      kind: 'list',
      title: 'Posts',
      breadcrumbs: [],
      catalogVersion: '1.0',
      actions: { header: [] },
    },
    data: {},
    pupitre,
  } as unknown as PupitrePageProps
}

test('redirect flash drains on a same-key URL visit and does not leak to later pages', async ({
  assert,
}) => {
  const { dom, restore } = installDom()
  dom.window.history.replaceState({}, '', '/admin/posts?q=foo')
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  const toasts: Array<{ type: string; title: string }> = []
  const visits: string[] = []
  const restoreRouter = setRouter({
    visit: (url: string, options?: { onSuccess?: () => void }) => {
      visits.push(url)
      options?.onSuccess?.()
    },
  } as unknown as RouterLike)

  try {
    const key = 'admin:posts:list::'
    await act(async () =>
      root.render(
        <PupitreContent registry={registry} props={pageProps(key, '/admin/posts?q=foo')} />
      )
    )
    await act(async () =>
      handleActionResult(
        {
          flash: [{ type: 'success', title: 'Deleted 3 posts' }],
          redirect: '/admin/posts',
        } as ActionResult,
        {
          data: {},
          pageKind: 'list',
          toast: () => assert.fail('redirect toast was shown before navigation'),
          setData: () => {},
          onNavigationComplete: () => toasts.push(...takePendingActionToasts()),
        }
      )
    )
    assert.deepEqual(visits, ['http://localhost/admin/posts'])
    await act(async () =>
      root.render(<PupitreContent registry={registry} props={pageProps(key, '/admin/posts')} />)
    )
    assert.deepEqual(toasts, [{ type: 'success', title: 'Deleted 3 posts' }])
    assert.deepEqual(takePendingActionToasts(), [])

    await act(async () =>
      root.render(<PupitreContent registry={registry} props={pageProps('admin:posts:edit:4:')} />)
    )
    assert.deepEqual(takePendingActionToasts(), [])
  } finally {
    await act(async () => root.unmount())
    restoreRouter()
    dom.happyDOM.abort()
    restore()
  }
})

test('toast expiry survives navigation and a newer toast keeps its own deadline', async ({
  assert,
}) => {
  const { dom, restore } = installDom()
  const container = dom.document.createElement('div')
  const root = createRoot(container as unknown as Element)
  mock.timers.enable({ apis: ['setTimeout'] })
  const visible = (title: string) =>
    [...container.querySelectorAll('[role="status"]')].some((node) =>
      node.textContent?.startsWith(title)
    )
  try {
    await act(async () =>
      root.render(
        <PupitreContent
          key="first"
          registry={registry}
          props={{
            ...pageProps('first'),
            pupitre: { ...pupitre, flash: [{ type: 'success', title: 'First' }] },
          }}
          toastDuration={5_000}
        />
      )
    )
    await act(async () => mock.timers.tick(0))
    assert.isTrue(visible('First'))
    await act(async () => mock.timers.tick(3_000))
    await act(async () =>
      root.render(
        <PupitreContent
          key="next"
          registry={registry}
          props={{
            ...pageProps('next'),
            pupitre: { ...pupitre, flash: [{ type: 'success', title: 'Second' }] },
          }}
          toastDuration={5_000}
        />
      )
    )
    await act(async () => mock.timers.tick(0))
    await act(async () => mock.timers.tick(1_999))
    assert.isTrue(visible('First'))
    assert.isTrue(visible('Second'))
    await act(async () => mock.timers.tick(1))
    assert.isFalse(visible('First'))
    assert.isTrue(visible('Second'))
    await act(async () => mock.timers.tick(3_000))
    assert.isFalse(visible('Second'))
  } finally {
    await act(async () => {
      for (const button of container.querySelectorAll('button')) button.click()
    })
    await act(async () => root.unmount())
    mock.timers.reset()
    await dom.happyDOM.abort()
    restore()
  }
})

test('zero duration stays manual and changing configuration does not replay flash', async ({
  assert,
}) => {
  const { dom, restore } = installDom()
  const container = dom.document.createElement('div')
  const root = createRoot(container as unknown as Element)
  const props = {
    ...pageProps('manual'),
    pupitre: { ...pupitre, flash: [{ type: 'info' as const, title: 'Manual notice' }] },
  }
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    await act(async () =>
      root.render(<PupitreContent registry={registry} props={props} toastDuration={0} />)
    )
    await act(async () => mock.timers.tick(0))
    await act(async () => mock.timers.tick(60_000))
    assert.include(container.textContent, 'Manual notice')
    await act(async () =>
      root.render(<PupitreContent registry={registry} props={props} toastDuration={5_000} />)
    )
    await act(async () => mock.timers.tick(5_000))
    const notices = [...container.querySelectorAll('[role="status"]')].filter((node) =>
      node.textContent?.startsWith('Manual notice')
    )
    assert.equal(notices.length, 1)
    await act(async () => notices[0].querySelector('button')!.click())
    assert.notInclude(container.textContent, 'Manual notice')
  } finally {
    await act(async () => {
      for (const button of container.querySelectorAll('button')) button.click()
    })
    await act(async () => root.unmount())
    mock.timers.reset()
    await dom.happyDOM.abort()
    restore()
  }
})
