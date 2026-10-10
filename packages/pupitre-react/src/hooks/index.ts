import { useCallback, useEffect, useState } from 'react'
import { useBoundProp, useStateStore, useStateValue } from '@json-render/react'
import type {
  FileUploadDescriptor,
  TableDescriptor,
  UploadResponse,
} from '@rikology/pupitre/catalog'
import { registerTableSelectionClearer } from '../bridge/actions.js'
import { currentUrl, getRouter, type RouterLike } from '../bridge/inertia.js'
import { useRuntime } from '../runtime.js'

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
  return useRuntime().runAction
}
export function useSubmitForm() {
  return useRuntime().submitForm
}
export function useToast() {
  return useRuntime().toast
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
          shouldBlock() &&
          !window.confirm(message)
        ) {
          event.preventDefault()
        }
      }
    )
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (shouldBlock()) {
        event.preventDefault()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      removeBefore()
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [shouldBlock, message])
}
export function useUpload(descriptor: FileUploadDescriptor) {
  const { page } = useRuntime()
  const resource = page.key.split(':')[1] ?? ''
  const upload = useCallback(
    async (file: File): Promise<UploadResponse> => {
      const body = new FormData()
      body.append('file', file)
      body.append('field', descriptor.name)
      body.append('resource', resource)
      const response = await fetch(descriptor.uploadUrl, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body,
      })
      if (!response.ok) throw new Error(`Upload failed (${response.status}).`)
      return (await response.json()) as UploadResponse
    },
    [descriptor.name, descriptor.uploadUrl, resource]
  )
  const remove = useCallback(
    async (key: string): Promise<void> => {
      const response = await fetch(descriptor.deleteUrl, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ key }),
      })
      if (!response.ok) throw new Error(`Upload removal failed (${response.status}).`)
    },
    [descriptor.deleteUrl]
  )
  return { upload, remove }
}
export function useTable(descriptor: TableDescriptor) {
  const { data } = useRuntime()
  const [selected, setSelected] = useState<Array<string | number>>([])
  const [isLoading, setIsLoading] = useState(false)
  useEffect(() => registerTableSelectionClearer(() => setSelected([])), [])
  const query = Object.fromEntries(currentUrl().searchParams.entries())
  const setQuery = useCallback((partial: Record<string, unknown>) => {
    const params = currentUrl().searchParams
    for (const [key, value] of Object.entries(partial)) {
      params.delete(key)
      if (value !== null && value !== undefined && value !== '') params.set(key, String(value))
    }
    const queryData = Object.fromEntries(params.entries())
    getRouter().reload({
      only: ['data'],
      data: queryData,
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
    const params = currentUrl().searchParams
    for (const key of [...params.keys()]) if (key.startsWith('filters[')) params.delete(key)
    setQuery(Object.fromEntries(params.entries()))
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
