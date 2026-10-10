import { createContext, useContext } from 'react'
import type { ActionDescriptor, PupitrePageProps } from '@rikology/pupitre/catalog'
import type { StateStore } from '@json-render/core'
import type { PupitreFunctions } from './registry/defineRegistry.js'
import type { ToastMessage } from './shell/types.js'

export type RuntimeContextValue = {
  store: StateStore
  page: PupitrePageProps['page']
  data: PupitrePageProps['data']
  panel: PupitrePageProps['pupitre']
  functions: PupitreFunctions & Record<string, unknown>
  runAction: (
    descriptor: ActionDescriptor,
    options?: { ids?: Array<string | number>; record?: Record<string, unknown> }
  ) => Promise<void>
  submitForm: () => void
  upload: (field: string, files: File[]) => Promise<unknown>
  toast: (toast: Omit<ToastMessage, 'id'>) => void
}
export const RuntimeContext = createContext<RuntimeContextValue | null>(null)
export function useRuntime(): RuntimeContextValue {
  const value = useContext(RuntimeContext)
  if (!value) throw new Error('Pupitre hooks must be used inside <Pupitre>.')
  return value
}
