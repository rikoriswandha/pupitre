import { useCallback, useEffect, useRef, useState } from 'react'
import { useBoundProp, useStateStore, useStateValue } from '@json-render/react'
import type {
  FileUploadDescriptor,
  TableDescriptor,
  UploadResponse,
} from '@rikology/pupitre/catalog'
import { deleteUpload, registerTableSelectionClearer, uploadFile } from '../bridge/actions.js'
import { currentUrl, getRouter, type RouterLike } from '../bridge/inertia.js'
import { usePageActions, useRuntime } from '../runtime.js'

export function useBoundValue<T>(
  value: T | undefined,
  binding: string | undefined
): [T | undefined, (next: T) => void] {
  return useBoundProp(value, binding)
}
export function useFieldError(error: unknown, binding?: string): string | undefined {
  const state = useStateStore()
  const path = binding?.startsWith('/data/') ? binding.replace('/data/', '/errors/') : undefined
  const result = error ?? (path ? state.get(path) : undefined)
  return typeof result === 'string' ? result : undefined
}
export { useStateValue }
export function useSetState(): (path: string, value: unknown) => void {
  const state = useStateStore()
  return useCallback((path: string, value: unknown) => state.set(path, value), [state])
}
export function usePanel() {
  const { panel, page } = useRuntime()
  return {
    panel: panel.panel,
    user: panel.user,
    locale: panel.locale,
    timezone: panel.timezone,
    urlFor: undefined,
    catalogVersion: page.catalogVersion,
  }
}
export function usePage() {
  const { page, data } = useRuntime()
  return { ...page, data }
}
export function useRunAction() {
  return usePageActions().runAction
}
export function useSubmitForm() {
  return useRuntime().submitForm
}
/** True when rendered inside an action modal (no page-level form chrome). */
export function useEmbedded() {
  return useRuntime().embedded
}
export function useToast() {
  return usePageActions().toast
}
/**
 * Inertia navigation for UI components (sidebar links, row clicks) without
 * importing `@inertiajs/react` in pupitre-ui.
 */
export function useVisit() {
  return useCallback(
    (url: string, options?: Parameters<RouterLike['visit']>[1]) => getRouter().visit(url, options),
    []
  )
}
/**
 * Blocks Inertia navigation and tab close while `shouldBlock()` is true
 * (Form `dirtyGuard`). Inertia visits ask `window.confirm(message)`.
 */
export function useNavigationGuard(shouldBlock: () => boolean, message: string) {
  // Subscribe once per mount; read the latest predicate/message through a ref so
  // typing (which changes `dirty`) never re-subscribes to router events.
  const latest = useRef({ shouldBlock, message })
  useEffect(() => {
    latest.current = { shouldBlock, message }
  })
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const removeBefore = getRouter().on(
      'before',
      (event: CustomEvent<{ visit: { method: string; only: string[] } }>) => {
        const visit = event.detail.visit
        if (
          visit.method === 'get' &&
          !visit.only.length &&
          latest.current.shouldBlock() &&
          !window.confirm(latest.current.message)
        ) {
          event.preventDefault()
        }
      }
    )
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (latest.current.shouldBlock()) {
        event.preventDefault()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      removeBefore()
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])
}
export function useUpload(descriptor: FileUploadDescriptor) {
  const { page } = useRuntime()
  const upload = useCallback(
    (file: File): Promise<UploadResponse> => uploadFile(descriptor, file, page.key),
    [descriptor, page.key]
  )
  const remove = useCallback(
    (key: string): Promise<void> => deleteUpload(descriptor, key, page.key),
    [descriptor, page.key]
  )
  return { upload, remove }
}
export function useTable(descriptor: TableDescriptor) {
  const { data } = useRuntime()
  const [selected, setSelected] = useState<Array<string | number>>([])
  const [isLoading, setIsLoading] = useState(false)
  useEffect(() => registerTableSelectionClearer(() => setSelected([])), [])
  const query = Object.fromEntries(currentUrl().searchParams.entries())
  // The URL is the single source of table state (ADR-0004): build the next URL
  // ourselves and make a partial visit so history/back button and reloads keep
  // the query, while only the top-level `data` prop is refetched (ADR-0011).
  const setQuery = useCallback((partial: Record<string, unknown>) => {
    const url = currentUrl()
    for (const [key, value] of Object.entries(partial)) {
      url.searchParams.delete(key)
      if (value !== null && value !== undefined && value !== '')
        url.searchParams.set(key, String(value))
    }
    const search = url.searchParams.toString()
    getRouter().visit(`${url.pathname}${search ? `?${search}` : ''}`, {
      only: ['data'],
      preserveState: true,
      preserveScroll: true,
      onStart: () => setIsLoading(true),
      onFinish: () => setIsLoading(false),
    })
  }, [])
  const setFilter = useCallback(
    (name: string, value: unknown) => {
      const params = currentUrl().searchParams
      const prefix = `filters[${name}]`
      const updates: Record<string, unknown> = {}
      for (const key of params.keys())
        if (key === prefix || key.startsWith(`${prefix}[`)) updates[key] = ''
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        for (const [key, fieldValue] of Object.entries(value))
          updates[`${prefix}[${key}]`] = fieldValue
      } else updates[prefix] = value
      setQuery(updates)
    },
    [setQuery]
  )
  const resetFilters = useCallback(() => {
    const updates: Record<string, unknown> = { page: '' }
    for (const key of currentUrl().searchParams.keys())
      if (key.startsWith('filters[')) updates[key] = ''
    setQuery(updates)
  }, [setQuery])
  return {
    data,
    query,
    setQuery,
    sort: (column: string) => setQuery({ sort: query.sort === column ? `-${column}` : column }),
    search: (q: string) => setQuery({ q, page: 1 }),
    setPage: (page: number) => setQuery({ page }),
    setPerPage: (perPage: number | 'all') => setQuery({ perPage }),
    setFilter,
    resetFilters,
    selected,
    setSelected,
    isLoading,
    descriptor,
  }
}
export { useBoundValue as useBoundProp }
