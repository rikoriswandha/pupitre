import { test } from '@japa/runner'
import { act } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import type { ActionDescriptor, PupitrePageProps } from '@rikology/pupitre/catalog'
import { PupitreContent } from '../src/page/Pupitre.js'
import { defineRegistry } from '../src/registry/defineRegistry.js'
import { useRunAction } from '../src/hooks/index.js'
import { setRouter } from '../src/bridge/inertia.js'
import type { RouterLike } from '../src/bridge/inertia.js'
import type { ShellProps } from '../src/shell/types.js'
import { setFetch } from '../src/bridge/actions.js'

function HeaderShell({ headerActions, children }: ShellProps & { children: ReactNode }) {
  const runAction = useRunAction()
  return (
    <div>
      {headerActions.map((action) => (
        <button key={action.name} type="button" onClick={() => runAction(action)}>
          {action.label}
        </button>
      ))}
      {children}
    </div>
  )
}

const registry = defineRegistry({
  Shell: HeaderShell,
  Toaster: () => null,
  Modal: () => null,
  ConfirmDialog: ({ onCancel }: { onCancel: () => void }) => (
    <div role="dialog">
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
  NotFound: () => null,
  Form: ({ children }: { children?: ReactNode }) => <form>{children}</form>,
  ImportModal: ({ open, action }: { open: boolean; action: ActionDescriptor }) =>
    open ? <div data-testid="import-modal">{action.label}</div> : null,
} as never)

const create: ActionDescriptor = {
  name: 'create',
  label: 'New post',
  kind: 'link',
  url: '/admin/posts/create',
  enabled: true,
}

const props = {
  pupitre: {
    panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
    user: null,
    tenant: null,
    nav: [],
    flash: [],
    locale: 'en',
    timezone: 'UTC',
  },
  page: {
    key: 'admin:posts:list::',
    kind: 'list',
    title: 'Posts',
    breadcrumbs: [],
    spec: { root: 'form', elements: { form: { type: 'Form', props: {} } } },
    state: {},
    actions: { header: [create] },
    catalogVersion: '1.0',
  },
} as unknown as PupitrePageProps

test('custom page specs render in the standard shell', async ({ assert }) => {
  const dom = new Window()
  Object.assign(globalThis, { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true })
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  const customProps = {
    ...props,
    page: { ...props.page, kind: 'custom' as const, component: 'admin/Reports' },
  } as unknown as PupitrePageProps
  try {
    await act(async () => root.render(<PupitreContent registry={registry} props={customProps} />))
    assert.isNotNull(container.querySelector('form'))
  } finally {
    await act(async () => root.unmount())
    dom.happyDOM.abort()
  }
})
test('shell header actions run outside the spec renderer store', async ({ assert }) => {
  const dom = new Window()
  Object.assign(globalThis, { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true })
  const visits: string[] = []
  const restoreRouter = setRouter({
    visit: (url: string) => visits.push(url),
    reload: () => {},
  } as unknown as RouterLike)
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  try {
    await act(async () => root.render(<PupitreContent registry={registry} props={props} />))
    const button = container.querySelector('button') as unknown as HTMLButtonElement
    await act(async () => button.click())
    assert.deepEqual(visits, ['/admin/posts/create'])
  } finally {
    await act(async () => root.unmount())
    restoreRouter()
    dom.happyDOM.abort()
  }
})

test('deep-linked actions open on load and set/clear URL params with the modal', async ({
  assert,
}) => {
  const dom = new Window()
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  const location = globalThis.window as unknown as { happyDOM: { setURL(url: string): void } }
  location.happyDOM.setURL('http://localhost/admin/posts/18/edit?action=publish&record=18')
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  const publish: ActionDescriptor = {
    name: 'publish',
    label: 'Publish',
    kind: 'confirm',
    url: '/admin/posts/actions/publish?record=18',
    enabled: true,
    deepLink: true,
  }
  const deepProps = {
    ...props,
    page: { ...props.page, kind: 'edit', actions: { header: [publish] } },
  } as unknown as PupitrePageProps
  try {
    await act(async () => root.render(<PupitreContent registry={registry} props={deepProps} />))
    const { promise, resolve } = Promise.withResolvers<void>()
    setTimeout(resolve, 0)
    await act(async () => promise)
    assert.exists(container.querySelector('[role="dialog"]'))
    assert.equal(new URL(dom.location.href).searchParams.get('action'), 'publish')
    assert.equal(new URL(dom.location.href).searchParams.get('record'), '18')
    await act(async () =>
      (container.querySelector('[role="dialog"] button') as unknown as HTMLButtonElement).click()
    )
    assert.equal(new URL(dom.location.href).search, '')
    await act(async () =>
      (container.querySelector('button') as unknown as HTMLButtonElement).click()
    )
    assert.equal(new URL(dom.location.href).searchParams.get('action'), 'publish')
    assert.equal(new URL(dom.location.href).searchParams.get('record'), '18')
    await act(async () =>
      (container.querySelector('[role="dialog"] button') as unknown as HTMLButtonElement).click()
    )
    assert.equal(new URL(dom.location.href).search, '')
  } finally {
    await act(async () => root.unmount())
    location.happyDOM.setURL('about:blank')
    dom.happyDOM.abort()
  }
})

test('global key bindings dispatch enabled header actions', async ({ assert }) => {
  const dom = new Window()
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  const visits: string[] = []
  const restoreRouter = setRouter({
    visit: (url: string) => visits.push(url),
    reload: () => {},
  } as unknown as RouterLike)
  const shortcut: ActionDescriptor = { ...create, keyBindings: ['ctrl+n'] }
  const shortcutProps = {
    ...props,
    page: { ...props.page, actions: { header: [shortcut] } },
  } as unknown as PupitrePageProps
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  try {
    await act(async () => root.render(<PupitreContent registry={registry} props={shortcutProps} />))
    await act(async () => {
      dom.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'n', ctrlKey: true }))
    })
    assert.deepEqual(visits, ['/admin/posts/create'])
  } finally {
    await act(async () => root.unmount())
    restoreRouter()
    dom.happyDOM.abort()
  }
})
test('import actions open their modal without posting the action endpoint', async ({ assert }) => {
  const dom = new Window()
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  let requests = 0
  const restoreFetch = setFetch(async () => {
    requests++
    return { ok: true, status: 200, json: async () => ({}) } as Response
  })
  const importAction: ActionDescriptor = {
    name: 'import',
    label: 'Import posts',
    kind: 'direct',
    url: '/admin/posts/import',
    method: 'post',
    enabled: true,
  }
  const importProps = {
    ...props,
    page: { ...props.page, actions: { header: [importAction] } },
  } as unknown as PupitrePageProps
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  try {
    await act(async () => root.render(<PupitreContent registry={registry} props={importProps} />))
    await act(async () =>
      (container.querySelector('button') as unknown as HTMLButtonElement).click()
    )
    assert.equal(
      container.querySelector('[data-testid="import-modal"]')?.textContent,
      'Import posts'
    )
    assert.equal(requests, 0)
  } finally {
    await act(async () => root.unmount())
    restoreFetch()
    dom.happyDOM.abort()
  }
})

for (const platform of ['MacIntel', 'Linux x86_64']) {
  test(`mod+s dispatches Cmd/Ctrl, never bare s on ${platform}`, async ({ assert }) => {
    const dom = new Window()
    Object.defineProperty(dom.navigator, 'platform', { value: platform })
    Object.assign(globalThis, {
      window: dom,
      document: dom.document,
      HTMLElement: dom.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    })
    const visits: string[] = []
    const restoreRouter = setRouter({
      visit: (url: string) => visits.push(url),
    } as unknown as RouterLike)
    const root = createRoot(dom.document.body as unknown as Element)
    try {
      await act(async () =>
        root.render(
          <PupitreContent
            registry={registry}
            props={{
              ...props,
              page: { ...props.page, actions: { header: [{ ...create, keyBindings: ['mod+s'] }] } },
            }}
          />
        )
      )
      await act(async () => {
        dom.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 's' }))
      })
      assert.lengthOf(visits, 0)
      await act(async () => {
        dom.dispatchEvent(
          new dom.KeyboardEvent('keydown', {
            key: 's',
            metaKey: platform === 'MacIntel',
            ctrlKey: platform !== 'MacIntel',
          })
        )
      })
      assert.deepEqual(visits, [create.url])
    } finally {
      await act(async () => root.unmount())
      restoreRouter()
      dom.happyDOM.abort()
    }
  })
}

test('page shortcuts include all field affix and hint actions', async ({ assert }) => {
  const dom = new Window()
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  const visits: string[] = []
  const restoreRouter = setRouter({
    visit: (url: string) => visits.push(url),
  } as unknown as RouterLike)
  const root = createRoot(dom.document.body as unknown as Element)
  const fieldActions = Object.fromEntries(
    ['prefixAction', 'suffixAction', 'hintAction'].map((key, index) => [
      key,
      { ...create, name: key, url: `/shortcut/${key}`, keyBindings: [`ctrl+${index + 1}`] },
    ])
  )
  try {
    await act(async () =>
      root.render(
        <PupitreContent
          registry={registry}
          props={{
            ...props,
            page: {
              ...props.page,
              spec: {
                root: 'form',
                elements: {
                  form: { type: 'Form', props: fieldActions },
                },
              },
            },
          }}
        />
      )
    )
    for (const key of ['1', '2', '3'])
      await act(async () => {
        dom.dispatchEvent(new dom.KeyboardEvent('keydown', { key, ctrlKey: true }))
      })
    assert.deepEqual(visits, [
      '/shortcut/prefixAction',
      '/shortcut/suffixAction',
      '/shortcut/hintAction',
    ])
  } finally {
    await act(async () => root.unmount())
    restoreRouter()
    dom.happyDOM.abort()
  }
})

test('navigation aborts queued export polling without an error toast', async ({ assert }) => {
  const dom = new Window()
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  const toasts: Array<{ type: string; title: string }> = []
  const exportRegistry = {
    ...registry,
    shell: {
      ...registry.shell,
      Toaster: ({ toasts: current }: { toasts: typeof toasts }) => {
        toasts.splice(0, toasts.length, ...current)
        return null
      },
    },
  }
  const progressRequested = Promise.withResolvers<void>()
  const restoreFetch = setFetch(async (input) => {
    if (String(input) === '/progress') {
      progressRequested.resolve()
      return new Response(
        JSON.stringify({ id: '1', status: 'queued', totalRows: 10, processedRows: 0 })
      )
    }
    return new Response(
      JSON.stringify({ jobId: '1', progressUrl: '/progress', downloadUrl: '/download' })
    )
  })
  const root = createRoot(dom.document.body as unknown as Element)
  const exportProps = {
    ...props,
    page: {
      ...props.page,
      actions: {
        header: [
          {
            ...create,
            name: 'export',
            kind: 'direct' as const,
            method: 'post' as const,
            url: '/export',
          },
        ],
      },
    },
  }
  try {
    await act(async () =>
      root.render(<PupitreContent registry={exportRegistry} props={exportProps} />)
    )
    const before = toasts.length
    await act(async () => {
      ;(dom.document.querySelector('button') as unknown as HTMLButtonElement).click()
      await progressRequested.promise
    })
    await act(async () =>
      root.render(
        <PupitreContent
          registry={exportRegistry}
          props={{ ...exportProps, page: { ...exportProps.page, key: 'next-page' } }}
        />
      )
    )
    assert.isFalse(toasts.slice(before).some((toast) => toast.type === 'error'))
  } finally {
    await act(async () => root.unmount())
    restoreFetch()
    dom.happyDOM.abort()
  }
})

test('widget data identity survives unrelated page updates and follows fresh prop values', async ({
  assert,
}) => {
  const dom = new Window()
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  const values: Record<string, unknown>[] = []
  const widgetRegistry = {
    ...registry,
    shell: {
      ...registry.shell,
      WidgetGrid: ({ data }: { data: Record<string, unknown> }) => {
        values.push(data)
        return null
      },
    },
  }
  const widget = {
    name: 'stats',
    kind: 'stats' as const,
    placement: 'header' as const,
    dataProp: 'widget_stats',
    span: 1,
  }
  const initial = { kind: 'stats', stats: [] }
  const widgetProps = {
    ...props,
    widget_stats: initial,
    page: { ...props.page, widgets: [widget] },
  } as unknown as PupitrePageProps
  const root = createRoot(dom.document.body as unknown as Element)
  try {
    await act(async () =>
      root.render(<PupitreContent registry={widgetRegistry} props={widgetProps} />)
    )
    const first = values.at(-1)
    await act(async () =>
      root.render(
        <PupitreContent
          registry={widgetRegistry}
          props={{ ...widgetProps, data: { unrelated: true } }}
        />
      )
    )
    assert.strictEqual(values.at(-1), first)
    const fresh = { kind: 'stats', stats: [{ label: 'Fresh', value: 7 }] }
    await act(async () =>
      root.render(
        <PupitreContent registry={widgetRegistry} props={{ ...widgetProps, widget_stats: fresh }} />
      )
    )
    assert.strictEqual(values.at(-1)?.widget_stats, fresh)
  } finally {
    await act(async () => root.unmount())
    dom.happyDOM.abort()
  }
})
