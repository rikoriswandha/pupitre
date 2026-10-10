import { test } from '@japa/runner'
import { act } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { defineRegistry } from '../src/registry/defineRegistry.js'
import { useBoundValue } from '../src/hooks/index.js'
import { PupitreRenderer } from '../src/renderer/PupitreRenderer.js'
import type { PupitreRendererProps } from '../src/renderer/PupitreRenderer.js'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import type { StateStore } from '@json-render/core'
import { SpecRenderer } from '../src/renderer/SpecRenderer.js'
import { RuntimeContext } from '../src/runtime.js'
import { createPupitreStore } from '../src/renderer/store.js'

function installDom() {
  const dom = new Window()
  const global = globalThis as unknown as Record<string, unknown>
  const globals: Record<string, unknown> = {
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
  }
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(global, key, { configurable: true, writable: true, value })
  return dom
}
const Field = ({
  props,
  bindings,
}: {
  props: { name?: string; value?: unknown }
  bindings?: Record<string, string>
}) => {
  const [value, setValue] = useBoundValue(props.value, bindings?.value)
  return (
    <input
      aria-label={props.name}
      value={String(value ?? '')}
      onChange={(event) => setValue(event.currentTarget.value)}
    />
  )
}
const runtimeRegistry = defineRegistry({
  Text: Field,
  Shell: ({ children }: { children: ReactNode }) => <>{children}</>,
  Toaster: () => null,
  Modal: () => null,
  ConfirmDialog: () => null,
  NotFound: () => null,
} as never)
function makePage(
  key: string,
  title: string,
  state: Record<string, unknown>
): PupitrePageProps['page'] {
  return {
    key,
    kind: 'edit',
    title,
    breadcrumbs: [],
    actions: { header: [] },
    catalogVersion: '0.1',
    state,
    spec: {
      root: 'field',
      elements: {
        field: { type: 'Text', props: { name: 'title', value: { $bindState: '/data/title' } } },
      },
    },
  } as unknown as PupitrePageProps['page']
}
const rendererProps = (
  page: PupitrePageProps['page'],
  errors?: Record<string, unknown>
): PupitreRendererProps => ({
  page,
  errors,
  pupitre: {} as never,
  registry: runtimeRegistry,
  runAction: async () => {},
  upload: async () => [],
  toast: () => {},
})

test.group('Pupitre renderer store lifecycle', () => {
  test('preserves user data on the same key, updates server-owned paths, and resets on a new key', async ({
    assert,
  }) => {
    const dom = installDom()
    const container = dom.document.createElement('div')
    dom.document.body.append(container)
    const root = createRoot(container as unknown as Element)
    let store: StateStore | undefined
    const render = (page: PupitrePageProps['page'], errors?: Record<string, unknown>) =>
      root.render(
        <PupitreRenderer
          {...rendererProps(page, errors)}
          onStore={(current) => {
            store = current
          }}
        />
      )
    try {
      await act(async () =>
        render(
          makePage('record:1', 'First', {
            data: { title: 'Server title' },
            meta: { record: { id: 1 } },
            errors: {},
            ui: { active: 'a' },
          })
        )
      )
      assert.exists(store)
      act(() => store?.set('/data/title', 'Typed value'))
      await act(async () =>
        render(
          makePage('record:1', 'Reloaded', {
            data: { title: 'New server title' },
            meta: { record: { id: 2 } },
            ui: { active: 'b' },
          }),
          { title: 'Invalid' }
        )
      )
      assert.equal(store?.get('/data/title'), 'Typed value')
      assert.deepEqual(store?.get('/meta/record'), { id: 2 })
      assert.deepEqual(store?.get('/errors'), { title: 'Invalid' })
      assert.equal(store?.get('/errors/title'), 'Invalid')
      assert.equal(store?.get('/ui/active'), 'a')
      await act(async () =>
        render(
          makePage('record:2', 'Other', {
            data: { title: 'Second record' },
            meta: { record: { id: 3 } },
            ui: {},
          })
        )
      )
      assert.equal(store?.get('/data/title'), 'Second record')
    } finally {
      await act(async () => root.unmount())
      dom.happyDOM.abort()
    }
  })
  test('renders a sub-spec with isolated state and reports only its changes', async ({ assert }) => {
    const dom = installDom()
    const container = dom.document.createElement('div')
    dom.document.body.append(container)
    const root = createRoot(container as unknown as Element)
    const parent = createPupitreStore({ data: { title: 'Parent' } })
    const page = makePage('sub-spec', 'Sub-spec', { data: { title: 'Parent' } })
    const changes: unknown[] = []
    try {
      await act(async () =>
        root.render(
          <RuntimeContext.Provider
            value={{
              store: parent.store,
              page,
              data: undefined,
              panel: {} as never,
              registry: runtimeRegistry,
              handlers: {},
              functions: runtimeRegistry.functions,
              runAction: async () => {},
              submitForm: () => {},
              upload: async () => [],
              toast: () => {},
            }}
          >
            <SpecRenderer
              spec={{
                root: 'field',
                state: { data: { title: 'Sub-spec' } },
                elements: {
                  field: {
                    type: 'Text',
                    props: { name: 'Sub title', value: { $bindState: '/data/title' } },
                  },
                },
              }}
              onStateChange={(state) => changes.push(state)}
            />
          </RuntimeContext.Provider>
        )
      )
      const input = container.querySelector('input')
      assert.exists(input)
      assert.equal(input?.value, 'Sub-spec')
      await act(async () => {
        if (!input) return
        input.value = 'Changed sub-spec'
        input.dispatchEvent(new dom.Event('input', { bubbles: true }))
        input.dispatchEvent(new dom.Event('change', { bubbles: true }))
      })
      assert.equal(parent.store.get('/data/title'), 'Parent')
      assert.equal((changes.at(-1) as { data?: { title?: string } } | undefined)?.data?.title, 'Changed sub-spec')
    } finally {
      await act(async () => root.unmount())
      dom.happyDOM.abort()
    }
  })
})
