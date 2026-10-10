import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { JSONUIProvider, Renderer } from '@json-render/react'
import type { ComputedFunction } from '@json-render/core'
import type { SetState } from '@json-render/react'
import type { JsonRenderSpec } from '@rikology/pupitre/catalog'
import { RuntimeContext, useRuntime } from '../runtime.js'
import type { RuntimeContextValue } from '../runtime.js'
import { getRegistryHandlers } from '../registry/defineRegistry.js'
import { createPupitreStore } from './store.js'

export type SpecRendererProps = {
  spec: JsonRenderSpec
  state?: Record<string, unknown>
  onStateChange?: (state: Record<string, unknown>) => void
}

export function SpecRenderer({ spec, state, onStateChange }: SpecRendererProps) {
  const runtime = useRuntime()
  const [local] = useState(() =>
    createPupitreStore(structuredClone(state ?? spec.state ?? {}) as Record<string, unknown>)
  )
  const { store, vanilla } = local

  useEffect(() => {
    if (!onStateChange) return
    return vanilla.subscribe((next, previous) => {
      if (next !== previous) onStateChange(next)
    })
  }, [onStateChange, vanilla])

  const dispatchState: SetState = (updater) => {
    const next = updater(store.getSnapshot())
    for (const [key, value] of Object.entries(next)) store.set(`/${key}`, value)
  }
  const localHandlers = getRegistryHandlers(runtime.registry.registry)(
    () => dispatchState,
    () => store.getSnapshot() as never
  )
  const handlers = { ...runtime.handlers }
  for (const action of ['setState', 'pushState', 'removeState'] as const) {
    const handler = localHandlers[action]
    if (handler) handlers[action] = handler
  }
  const context: RuntimeContextValue = { ...runtime, store }

  return (
    <RuntimeContextProvider value={context}>
      <JSONUIProvider
        registry={runtime.registry.registry}
        store={store}
        handlers={handlers}
        functions={runtime.functions as Record<string, ComputedFunction>}
      >
        <Renderer spec={spec as never} registry={runtime.registry.registry} />
      </JSONUIProvider>
    </RuntimeContextProvider>
  )
}

// Keep hooks inside the active Pupitre runtime while redirecting state access to
// this sub-spec's isolated store.
function RuntimeContextProvider({
  value,
  children,
}: {
  value: RuntimeContextValue
  children: ReactNode
}) {
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
}
