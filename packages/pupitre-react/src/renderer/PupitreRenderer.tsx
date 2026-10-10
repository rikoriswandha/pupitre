import { useEffect, useState } from 'react'
import { JSONUIProvider, Renderer } from '@json-render/react'
import type { SetState } from '@json-render/react'
import type { StateStore } from '@json-render/core'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import { createPupitreStore } from './store.js'
import { mapErrors } from '../bridge/errors.js'
import { visit, reload, submitForm as submitPageForm } from '../bridge/actions.js'
import { RuntimeContext } from '../runtime.js'
import type { RuntimeContextValue } from '../runtime.js'
import { getRegistryHandlers } from '../registry/defineRegistry.js'
import type { PupitreRegistry } from '../registry/defineRegistry.js'

export type PupitreRendererProps = {
  page: PupitrePageProps['page']
  data?: PupitrePageProps['data']
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
    if (
      typeof window !== 'undefined' &&
      (typeof process === 'undefined' || process.env.NODE_ENV !== 'production')
    ) {
      ;(
        window as Window & { __pupitre?: { store: StateStore; page: PupitrePageProps['page'] } }
      ).__pupitre = { store, page }
    }
  }, [page, store])
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
    evaluate: async () => {
      if (typeof process === 'undefined' || process.env.NODE_ENV !== 'production')
        console.warn('Pupitre evaluate endpoint is available in M3.')
    },
    fetchOptions: async () => {
      if (typeof process === 'undefined' || process.env.NODE_ENV !== 'production')
        console.warn('Pupitre dynamic options endpoint is available in M2.')
    },
  }
  const submitForm = embedded ? embedded.submit : () => submitPageForm(page, store, toast)
  const context: RuntimeContextValue = {
    store,
    page,
    data,
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
      >
        <Renderer spec={page.spec as never} registry={registry.registry} />
      </JSONUIProvider>
    </RuntimeContext.Provider>
  )
}
