import { createStoreAdapter } from '@json-render/core/store-utils'
import type { StateStore } from '@json-render/core'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'

export type PupitreStore = { vanilla: StoreApi<Record<string, unknown>>; store: StateStore }
export function createPupitreStore(initialState: Record<string, unknown>): PupitreStore {
  const vanilla = createStore<Record<string, unknown>>(() => initialState)
  const store = createStoreAdapter({
    getSnapshot: () => vanilla.getState() as never,
    setSnapshot: (next) => vanilla.setState(next as never, true),
    subscribe: (listener) => vanilla.subscribe(listener),
  })
  return { vanilla, store }
}
export function setPath(store: StateStore, path: string, value: unknown): void {
  store.set(path, value)
}
export function getPath(store: StateStore, path: string): unknown {
  return store.get(path)
}
