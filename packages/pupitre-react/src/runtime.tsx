import { createContext, useContext } from 'react'
import type { ActionDescriptor, PupitrePageProps } from '@rikology/pupitre/catalog'
import type { StateStore } from '@json-render/core'
import type { PupitreFunctions } from './registry/defineRegistry.js'
import type { ToastMessage } from './shell/types.js'

import type { PupitreRegistry } from './registry/defineRegistry.js'
export type RuntimeContextValue = {
  store: StateStore
  page: PupitrePageProps['page']
  data: PupitrePageProps['data']
  tableDataProps?: Record<string, unknown>
  panel: PupitrePageProps['pupitre']
  registry: PupitreRegistry
  handlers: Record<string, (params: Record<string, unknown>) => Promise<unknown> | unknown>
  functions: PupitreFunctions & Record<string, unknown>
  runAction: (
    descriptor: ActionDescriptor,
    options?: { ids?: Array<string | number>; record?: Record<string, unknown> }
  ) => Promise<void>
  submitForm: () => void
  /** True inside an action modal: the host owns submit/cancel buttons. */
  embedded: boolean
  upload: (field: string, files: File[]) => Promise<unknown>
  toast: (toast: Omit<ToastMessage, 'id'>) => void
}
export const RuntimeContext = createContext<RuntimeContextValue | null>(null)
export function useRuntime(): RuntimeContextValue {
  const value = useContext(RuntimeContext)
  if (!value) throw new Error('Pupitre hooks must be used inside <Pupitre>.')
  return value
}
export function useOptionalRuntime(): RuntimeContextValue | null {
  return useContext(RuntimeContext)
}

/**
 * Page-level services available outside the spec renderer (the Shell renders
 * header actions and toasts around `PupitreRenderer`, which owns the store).
 */
export type PageActionsContextValue = Pick<RuntimeContextValue, 'runAction' | 'toast'>
export const PageActionsContext = createContext<PageActionsContextValue | null>(null)
export function usePageActions(): PageActionsContextValue {
  const runtime = useContext(RuntimeContext)
  const page = useContext(PageActionsContext)
  const value = runtime ?? page
  if (!value) throw new Error('Pupitre hooks must be used inside <Pupitre>.')
  return value
}
export function useOptionalPageActions(): PageActionsContextValue | null {
  const runtime = useContext(RuntimeContext)
  const page = useContext(PageActionsContext)
  return runtime ?? page
}
