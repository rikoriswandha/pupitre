import { test } from '@japa/runner'
import { act } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import type { ActionDescriptor, PupitrePageProps } from '@rikology/pupitre/catalog'
import { defineRegistry } from '../src/registry/defineRegistry.js'
import { useBoundValue, useFieldError } from '../src/hooks/index.js'
import { ActionModal } from '../src/renderer/ActionModal.js'
import type { RouterLike } from '../src/bridge/inertia.js'
import { setRouter } from '../src/bridge/inertia.js'

function installDom() {
  const dom = new Window()
  const global = globalThis as unknown as Record<string, unknown>
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
  }))
    Object.defineProperty(global, key, { configurable: true, writable: true, value })
  return dom
}
const Text = ({
  props,
  bindings,
}: {
  props: Record<string, unknown>
  bindings?: Record<string, string>
}) => {
  const [value, setValue] = useBoundValue(props.value, bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  return (
    <label>
      {String(props.name)}
      <input
        name={String(props.name)}
        value={String(value ?? '')}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
      {error && <span role="alert">{error}</span>}
    </label>
  )
}
const registry = defineRegistry({
  Text,
  Shell: ({ children }: { children: ReactNode }) => <>{children}</>,
  Toaster: () => null,
  Modal: ({ children, footer }: { children: ReactNode; footer?: ReactNode }) => (
    <section data-testid="modal">
      {children}
      {footer}
    </section>
  ),
  ConfirmDialog: () => null,
  NotFound: () => null,
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
const action = {
  name: 'edit',
  label: 'Edit',
  kind: 'form',
  url: '/posts/actions/edit',
  enabled: true,
} as ActionDescriptor

test('action form GET renders a separate form store and validation keeps the modal open', async ({
  assert,
}) => {
  const dom = installDom()
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  const calls: Array<{ method: string; args: unknown[] }> = []
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args })
    }
  const restoreRouter = setRouter({
    visit: record('visit'),
    reload: record('reload'),
    get: record('get'),
    post: record('post'),
    put: record('put'),
    patch: record('patch'),
    delete: record('delete'),
  } as unknown as RouterLike)
  const originalFetch = globalThis.fetch
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: async (_url: string | URL | Request, init?: RequestInit) => {
      if (!init?.method || init.method === 'GET')
        return {
          ok: true,
          json: async () => ({
            spec: {
              root: 'field',
              elements: {
                field: {
                  type: 'Text',
                  props: { name: 'title', value: { $bindState: '/data/title' } },
                },
              },
            },
            state: { data: { title: 'Draft' } },
            catalogVersion: '0.1',
          }),
        }
      return { ok: true, json: async () => ({}) }
    },
  })
  try {
    await act(async () =>
      root.render(
        <ActionModal
          action={action}
          ids={[7]}
          registry={registry.shell}
          runtimeRegistry={registry}
          pupitre={pupitre}
          close={() => {}}
          toast={() => {}}
        />
      )
    )
    const { promise, resolve } = Promise.withResolvers<void>()
    setTimeout(resolve, 0)
    await act(async () => promise)
    assert.exists(container.querySelector('[data-testid="modal"]'))
    assert.equal((container.querySelector('input') as HTMLInputElement | null)?.value, 'Draft')
    await act(async () =>
      (container.querySelector('button') as unknown as HTMLButtonElement).click()
    )
    assert.equal(calls[0]?.method, 'post')
    assert.equal(calls[0]?.args[0], action.url)
    assert.deepEqual(calls[0]?.args[1], { data: { title: 'Draft' }, ids: [7] })
    const options = calls[0]?.args[2] as { onError: (errors: Record<string, string>) => void }
    await act(async () => options.onError({ title: 'Invalid title' }))
    assert.equal(container.querySelector('[role="alert"]')?.textContent, 'Invalid title')
    assert.exists(container.querySelector('[data-testid="modal"]'))
  } finally {
    await act(async () => root.unmount())
    restoreRouter()
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: originalFetch,
    })
    dom.happyDOM.abort()
  }
})
