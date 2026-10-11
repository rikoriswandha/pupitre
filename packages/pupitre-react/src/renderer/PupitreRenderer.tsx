import { evaluateResponse } from '@rikology/pupitre/catalog'
import type { ActionDescriptor, PupitrePageProps } from '@rikology/pupitre/catalog'
import { isDev } from '../dev.js'
import { useEffect, useRef, useState } from 'react'
import { JSONUIProvider, Renderer } from '@json-render/react'
import type { SetState } from '@json-render/react'
import type { StateStore } from '@json-render/core'
import { createPupitreStore } from './store.js'
import { mapErrors } from '../bridge/errors.js'
import { visit, reload, submitForm as submitPageForm } from '../bridge/actions.js'
import { RuntimeContext } from '../runtime.js'
import type { RuntimeContextValue } from '../runtime.js'
import { getRegistryHandlers } from '../registry/defineRegistry.js'
import type { PupitreRegistry } from '../registry/defineRegistry.js'
import { jsonFetch } from '../bridge/actions.js'
export function exposePupitreDevContext(
  target: Window,
  enabled: boolean,
  context: { store: StateStore; page: PupitrePageProps['page'] }
): void {
  if (enabled) (target as Window & { __pupitre?: typeof context }).__pupitre = context
}
function readPath(value: unknown, path: string): unknown {
  return path
    .split('/')
    .filter(Boolean)
    .reduce<unknown>(
      (current, segment) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[segment]
          : undefined,
      value
    )
}

function writePath(store: StateStore, path: string, value: unknown): void {
  const keys = path.split('/').filter(Boolean)
  if (keys[0] !== 'data' || keys.length < 2) return
  store.set(path, value)
}
type ServerWatch = { params: Record<string, unknown> }
function serverWatches(page: PupitrePageProps['page']): ServerWatch[] {
  const output: ServerWatch[] = []
  for (const element of Object.values(page.spec.elements)) {
    if (!element.watch) continue
    for (const bindings of Object.values(element.watch)) {
      for (const binding of Array.isArray(bindings) ? bindings : [bindings]) {
        if (
          !binding ||
          typeof binding !== 'object' ||
          !('action' in binding) ||
          binding.action !== 'evaluate'
        )
          continue
        const params = 'params' in binding ? binding.params : undefined
        if (
          params &&
          typeof params === 'object' &&
          'field' in params &&
          typeof params.field === 'string'
        )
          output.push({ params: params as Record<string, unknown> })
      }
    }
  }
  return output
}

function valuesAtPattern(value: unknown, pattern: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const walk = (current: unknown, parts: string[], path: string[]) => {
    const [part, ...rest] = parts
    if (part === undefined) {
      result[path.join('.')] = current
      return
    }
    if (part === '*') {
      if (!Array.isArray(current)) return
      current.forEach((item, index) => walk(item, rest, [...path, String(index)]))
      return
    }
    if (!current || typeof current !== 'object') return
    walk((current as Record<string, unknown>)[part], rest, [...path, part])
  }
  walk(value, pattern.split('.'), [])
  return result
}

export type PupitreRendererProps = {
  page: PupitrePageProps['page']
  data?: PupitrePageProps['data']
  tableDataProps?: Record<string, unknown>
  errors?: Record<string, unknown>
  pupitre: PupitrePageProps['pupitre']
  registry: PupitreRegistry
  runAction: RuntimeContextValue['runAction']
  upload: RuntimeContextValue['upload']
  toast: RuntimeContextValue['toast']
  onStore?: (store: StateStore) => void
  /**
   * Embedded renderers (action modals) submit through their host instead of
   * the page Form protocol; components hide their own submit chrome.
   */
  embedded?: { submit: () => void }
}
export function PupitreRenderer(props: PupitreRendererProps) {
  return <PupitreRendererInstance key={props.page.key} {...props} />
}
function PupitreRendererInstance({
  page,
  data,
  tableDataProps,
  errors,
  pupitre,
  registry,
  runAction,
  upload,
  toast,
  onStore,
  embedded,
}: PupitreRendererProps) {
  const [runtime] = useState(() => {
    const initial = structuredClone((page.state ?? {}) as Record<string, unknown>)
    const state = createPupitreStore(initial)
    if (errors) mapErrors(state.store, errors)
    return state
  })
  const { store } = runtime
  useEffect(() => {
    const state = page.state as Record<string, unknown>
    const meta =
      state.meta && typeof state.meta === 'object' ? (state.meta as Record<string, unknown>) : {}
    store.set('/meta/record', meta.record)
    store.set('/errors', {})
    if (errors) mapErrors(store, errors)
    store.set('/options', state.options)
  }, [page.state, errors, store])
  useEffect(() => {
    onStore?.(store)
  }, [onStore, store])
  useEffect(() => {
    if (typeof window === 'undefined') return
    exposePupitreDevContext(window, isDev, { store, page })
  }, [page, store])
  const evaluations = useRef({
    timers: new Map<string, ReturnType<typeof setTimeout>>(),
    sequences: new Map<string, number>(),
  })
  useEffect(
    () => () => {
      for (const timer of evaluations.current.timers.values()) clearTimeout(timer)
      evaluations.current.timers.clear()
      evaluations.current.sequences.clear()
    },
    []
  )
  const dispatchState: SetState = (updater) => {
    const next = updater(store.getSnapshot())
    for (const [key, value] of Object.entries(next)) store.set(`/${key}`, value)
  }
  const handlers = getRegistryHandlers(registry.registry)(
    () => dispatchState,
    () => store.getSnapshot() as never
  )
  const bridge = {
    ...handlers,
    visit: async (params: Record<string, unknown>) => visit(params),
    reload: async (params: Record<string, unknown>) => reload(params),
    evaluate: async (params: Record<string, unknown>) => {
      const field = String(params.field ?? '')
      const sequence = (evaluations.current.sequences.get(field) ?? 0) + 1
      evaluations.current.sequences.set(field, sequence)
      clearTimeout(evaluations.current.timers.get(field))
      return new Promise<void>((resolve) => {
        const debounce = Math.max(0, Number(params.debounce) || 0)
        const timer = setTimeout(async () => {
          evaluations.current.timers.delete(field)
          const snapshot = store.getSnapshot() as Record<string, unknown>
          const state = snapshot.data
          const meta = snapshot.meta
          const record = readPath(meta, 'record') as Record<string, unknown> | undefined
          const response = await jsonFetch(String(params.url ?? ''), {
            method: 'POST',
            body: JSON.stringify({
              resource: String(params.resource ?? ''),
              page: page.kind,
              field,
              state: state && typeof state === 'object' ? state : {},
              ...(record && (typeof record.id === 'string' || typeof record.id === 'number')
                ? { record: record.id }
                : {}),
            }),
          }).catch(() => undefined)
          if (!response?.ok || evaluations.current.sequences.get(field) !== sequence) {
            resolve()
            return
          }
          const parsed = evaluateResponse.safeParse(await response.json().catch(() => undefined))
          if (!parsed.success) {
            resolve()
            return
          }
          const latest = store.getSnapshot()
          for (const [path, value] of Object.entries(parsed.data.set)) {
            if (!path.startsWith('/data/') || path.includes('..')) continue
            const before = readPath(snapshot, path)
            const current = readPath(latest, path)
            if (JSON.stringify(current) === JSON.stringify(before)) writePath(store, path, value)
          }
          resolve()
        }, debounce)
        evaluations.current.timers.set(field, timer)
      })
    },
    submitForm: async () => submitForm(),
    openAction: async (params: Record<string, unknown>) =>
      runAction(params.action as never, { ids: params.ids as Array<string | number> | undefined }),
    runAction: async (params: Record<string, unknown>) =>
      runAction(
        {
          name: 'runAction',
          label: 'Action',
          kind: 'direct',
          enabled: true,
          url: String(params.url ?? ''),
          method: (params.method as ActionDescriptor['method']) ?? 'post',
          keyBindings: Array.isArray(params.keyBindings)
            ? params.keyBindings.map(String)
            : undefined,
        } as never,
        { ids: params.ids as Array<string | number> | undefined }
      ),
    toast: async (params: Record<string, unknown>) =>
      toast({
        type: params.type as 'success' | 'error' | 'warning' | 'info',
        title: String(params.title ?? ''),
        body: typeof params.body === 'string' ? params.body : undefined,
      }),
    copy: async (params: Record<string, unknown>) => {
      if (typeof navigator !== 'undefined' && navigator.clipboard)
        await navigator.clipboard.writeText(String(params.text ?? ''))
    },
    upload: async (params: Record<string, unknown>) =>
      upload(
        String(params.field ?? ''),
        Array.isArray(params.files) ? (params.files as File[]) : []
      ),
  }
  const evaluateAction = useRef(bridge.evaluate)
  useEffect(() => {
    evaluateAction.current = bridge.evaluate
  }, [bridge.evaluate])
  useEffect(() => {
    const watchers = serverWatches(page)
    if (!watchers.length) return
    let previous = store.getSnapshot()
    const unsubscribe = store.subscribe(() => {
      const current = store.getSnapshot()
      const beforeData = previous.data
      const currentData = current.data
      for (const watcher of watchers) {
        const pattern = String(watcher.params.field)
        const before = valuesAtPattern(beforeData, pattern)
        const after = valuesAtPattern(currentData, pattern)
        for (const [field, value] of Object.entries(after)) {
          if (Object.is(value, before[field])) continue
          void evaluateAction.current({ ...watcher.params, field })
        }
      }
      previous = current
    })
    return unsubscribe
  }, [page, store])
  const submitForm = embedded ? embedded.submit : () => submitPageForm(page, store, toast)
  const context: RuntimeContextValue = {
    store,
    page,
    data,
    tableDataProps,
    panel: pupitre,
    registry,
    handlers: bridge,
    functions: registry.functions,
    runAction,
    submitForm,
    embedded: Boolean(embedded),
    upload,
    toast,
  }
  return (
    <RuntimeContext.Provider value={context}>
      <JSONUIProvider
        registry={registry.registry}
        store={store}
        handlers={bridge}
        functions={registry.functions}
        directives={registry.directives}
      >
        <Renderer spec={page.spec as never} registry={registry.registry} />
      </JSONUIProvider>
    </RuntimeContext.Provider>
  )
}
