import { type StateStore, defineCatalog } from '@json-render/core'
import { createStoreAdapter } from '@json-render/core/store-utils'
import { Input } from '@base-ui/react/input'
import {
  JSONUIProvider,
  Renderer,
  defineRegistry,
  useBoundProp,
  useStateStore,
} from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import { z } from 'zod'
import React, { useEffect, useRef, useState } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'

const props = z.object({
  name: z.string().optional(),
  value: z.unknown().optional(),
  index: z.unknown().optional(),
  content: z.unknown().optional(),
  label: z.string().optional(),
  descriptor: z.unknown().optional(),
  error: z.unknown().optional(),
  itemKey: z.unknown().optional(),
})

export const catalog = defineCatalog(schema, {
  components: {
    Form: { props, description: 'Test form' },
    Repeater: { props, description: 'Test repeater' },
    RepeaterItem: { props, description: 'Test repeater item' },
    Text: { props, description: 'Test text' },
    Number: { props, description: 'Test number' },
    Placeholder: { props, description: 'Test computed value' },
    Button: { props, description: 'Test button' },
    Visibility: { props, description: 'Visibility probe' },
    BaseInput: { props, description: 'Base UI input' },
  },
  actions: {
    appendLog: { params: z.object({ value: z.string() }), description: 'Append action log' },
    asyncWrite: {
      params: z.object({ path: z.string(), value: z.unknown() }),
      description: 'Write asynchronously',
    },
  },
})

export interface SpikeStore {
  vanilla: StoreApi<Record<string, unknown>>
  store: StateStore
}

export function makeStore(initialState: Record<string, unknown>): SpikeStore {
  const vanilla = createStore<Record<string, unknown>>(() => initialState)
  const store = createStoreAdapter({
    getSnapshot: () => vanilla.getState() as never,
    setSnapshot: (next) => vanilla.setState(next as never, true),
    subscribe: (listener) => vanilla.subscribe(listener),
  })
  return { vanilla, store }
}

const mounted: Record<string, number> = {}
export function clearMounts() {
  for (const key of Object.keys(mounted)) delete mounted[key]
}
export function mountCount(name: string) {
  return mounted[name] ?? 0
}
const repeatedItemMounts: Record<string, number> = {}
export function clearRepeatedItemMounts() {
  for (const key of Object.keys(repeatedItemMounts)) delete repeatedItemMounts[key]
}
export function repeatedItemMountCount(key: string) {
  return repeatedItemMounts[key] ?? 0
}
export const actionLog: string[] = []
export function clearActionLog() {
  actionLog.length = 0
}

const registryResult = defineRegistry(catalog, {
  components: {
    Form: ({ children }) => {
      useEffect(() => {
        mounted.Form = mountCount('Form') + 1
      }, [])
      return <form data-testid="form">{children}</form>
    },
    Repeater: ({ children }) => <div data-testid="repeater">{children}</div>,
    RepeaterItem: ({ props: itemProps, children }) => {
      const itemKey = String(itemProps.itemKey)
      useEffect(() => {
        repeatedItemMounts[itemKey] = repeatedItemMountCount(itemKey) + 1
      }, [itemKey])
      return (
        <section
          data-testid={`item-${String(itemProps.index)}`}
          data-index={String(itemProps.index)}
          data-item-key={itemKey}
        >
          {children}
        </section>
      )
    },
    Text: ({ props: fieldProps, bindings }) => {
      const state = useStateStore()
      const [value, setValue] = useBoundProp<string>(fieldProps.value as string, bindings?.value)
      const errorPath = bindings?.value?.replace('/data/', '/errors/')
      const error = useFieldError(
        fieldProps.error,
        errorPath ? state.get(errorPath) : undefined,
        bindings?.value
      )
      return (
        <label>
          {fieldProps.name}
          <input
            aria-label={fieldProps.name}
            value={value ?? ''}
            onChange={(event) => setValue(event.currentTarget.value)}
            data-path={bindings?.value}
          />
          {error && <span role="alert">{error}</span>}
        </label>
      )
    },
    Number: ({ props: fieldProps, bindings }) => {
      const [value, setValue] = useBoundProp<number>(fieldProps.value as number, bindings?.value)
      return (
        <input
          aria-label={fieldProps.name}
          type="number"
          value={value ?? 0}
          onChange={(event) => setValue(Number(event.currentTarget.value))}
          data-path={bindings?.value}
        />
      )
    },
    Placeholder: ({ props: placeholderProps }) => (
      <output data-testid="subtotal">{String(placeholderProps.content ?? '')}</output>
    ),
    Button: ({ props: buttonProps, emit }) => (
      <button
        type="button"
        data-testid={`button-${String(buttonProps.name)}-${String(buttonProps.index ?? 'global')}`}
        onClick={() => emit('press')}
      >
        {buttonProps.label ?? buttonProps.name}
      </button>
    ),
    Visibility: ({ props: visibilityProps }) => <i data-testid={String(visibilityProps.name)} />,
    BaseInput: ({ props: inputProps, bindings }) => {
      const [value, setValue] = useBoundProp<string>(inputProps.value as string, bindings?.value)
      return (
        <Input
          aria-label={inputProps.name}
          value={value ?? ''}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
      )
    },
  },
  actions: {
    appendLog: async (params) => {
      actionLog.push(params?.value as string)
    },
    asyncWrite: async (params, setState) => {
      await Promise.resolve()
      const path = (params?.path as string).split('/').slice(1)

      setState((state) => {
        const updated = structuredClone(state) as Record<string, unknown>
        let cursor = updated
        for (const segment of path.slice(0, -1)) cursor = cursor[segment] as Record<string, unknown>
        cursor[path.at(-1)!] = params?.value
        return updated
      })
    },
  },
})
export const registry = registryResult.registry

export function useFieldError(errorProp: unknown, fallback: unknown, bindingPath?: string) {
  if (bindingPath?.startsWith('/data/')) return typeof fallback === 'string' ? fallback : undefined
  return typeof errorProp === 'string' ? errorProp : undefined
}

export type HarnessSpec = {
  root: string
  elements: Record<string, unknown>
  state?: Record<string, unknown>
}

export function Harness({
  spec,
  store,
  pageKey = 'spike',
  initialState,
  onStore,
  handlers = {},
}: {
  spec: HarnessSpec
  store?: StateStore
  pageKey?: string
  initialState?: Record<string, unknown>
  onStore?: (store: StateStore) => void
  handlers?: Record<string, (params: Record<string, unknown>) => Promise<void>>
}) {
  if (store) {
    return <HarnessProviders spec={spec} store={store} handlers={handlers} />
  }
  return (
    <RefStoreHarness
      key={pageKey}
      spec={spec}
      initialState={initialState}
      onStore={onStore}
      handlers={handlers}
    />
  )
}

function RefStoreHarness({
  spec,
  initialState,
  onStore,
  handlers,
}: {
  spec: HarnessSpec
  initialState?: Record<string, unknown>
  onStore?: (store: StateStore) => void
  handlers: Record<string, (params: Record<string, unknown>) => Promise<void>>
}) {
  const [ownedStore] = useState(() => makeStore(initialState ?? spec.state ?? {}))
  const storeRef = useRef<SpikeStore | null>(null)
  useEffect(() => {
    storeRef.current = ownedStore
    onStore?.(ownedStore.store)
  }, [onStore, ownedStore])
  return <HarnessProviders spec={spec} store={ownedStore.store} handlers={handlers} />
}

function HarnessProviders({
  spec,
  store,
  handlers,
}: {
  spec: HarnessSpec
  store: StateStore
  handlers: Record<string, (params: Record<string, unknown>) => Promise<void>>
}) {
  const registeredHandlers = registryResult.handlers(
    () => (updater) => {
      const next = updater(store.getSnapshot())
      store.update(
        Object.fromEntries(Object.entries(next).map(([key, value]) => [`/${key}`, value]))
      )
    },
    () => store.getSnapshot()
  )
  return (
    <JSONUIProvider
      registry={registry}
      store={store}
      handlers={{ ...registeredHandlers, ...handlers }}
      functions={{ mul: ({ a, b }) => Number(a) * Number(b) }}
    >
      <Renderer spec={spec as never} registry={registry} />
    </JSONUIProvider>
  )
}

export function mountHarness(
  spec: HarnessSpec,
  state?: Record<string, unknown>,
  pageKey = 'spike'
) {
  const window = new Window()
  Object.defineProperties(globalThis, {
    window: { configurable: true, writable: true, value: window },
    document: { configurable: true, writable: true, value: window.document },
    navigator: { configurable: true, writable: true, value: window.navigator },
    HTMLElement: { configurable: true, writable: true, value: window.HTMLElement },
    Event: { configurable: true, writable: true, value: window.Event },
    MouseEvent: { configurable: true, writable: true, value: window.MouseEvent },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
  })
  const container = window.document.createElement('div')
  window.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  let currentStore: StateStore | null = null
  const onStore = (store: StateStore) => {
    currentStore = store
  }
  act(() =>
    root.render(<Harness spec={spec} pageKey={pageKey} initialState={state} onStore={onStore} />)
  )
  const exposedStore = {
    get store(): StateStore {
      if (!currentStore) throw new Error('Harness provider has no store')
      return currentStore
    },
  }
  return {
    container,
    root,
    store: exposedStore,
    window,
    render: (next: React.ReactNode) => act(() => root.render(next)),
    renderPage: (nextSpec: HarnessSpec, nextPageKey: string) =>
      act(() => root.render(<Harness spec={nextSpec} pageKey={nextPageKey} onStore={onStore} />)),
    unmount: () => {
      act(() => root.unmount())
      for (const name of [
        'window',
        'document',
        'navigator',
        'HTMLElement',
        'Event',
        'MouseEvent',
        'IS_REACT_ACT_ENVIRONMENT',
      ]) {
        Reflect.deleteProperty(globalThis, name)
      }
      window.happyDOM.abort()
    },
  }
}

export function getByTestId(container: HTMLElement, id: string) {
  const element = container.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`Missing test element: ${id}`)
  return element
}

export function changeInput(input: HTMLInputElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
}

export function click(element: HTMLElement) {
  act(() => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))
}
