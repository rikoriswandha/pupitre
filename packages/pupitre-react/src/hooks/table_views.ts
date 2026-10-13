import { useCallback, useEffect, useState } from 'react'
import type { TableDescriptor, TableViewDescriptor } from '@rikology/pupitre/catalog'
import { tableViewDescriptor } from '@rikology/pupitre/catalog'
import { jsonFetch } from '../bridge/actions.js'
import { getRouter, currentUrl } from '../bridge/inertia.js'
import { t } from '../i18n.js'

const keys = ['q', 'sort', 'filters', 'groupBy', 'perPage', 'tab', 'columns', 'page', 'view']
export function useTableViews(
  descriptor: TableDescriptor,
  onColumns: (columns: Record<string, boolean>) => void
) {
  const [items, setItems] = useState(descriptor.views?.items ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState(descriptor.views)
  if (source !== descriptor.views) {
    setSource(descriptor.views)
    setItems(descriptor.views?.items ?? [])
  }
  const viewKey = descriptor.queryPrefix ? `${descriptor.queryPrefix}[view]` : 'view'
  const active = items.find((view) => view.id === currentUrl().searchParams.get(viewKey))
  const apply = useCallback(
    (view: TableViewDescriptor) => {
      const url = currentUrl()
      for (const key of [...url.searchParams.keys()]) {
        const inner = descriptor.queryPrefix
          ? key.startsWith(`${descriptor.queryPrefix}[`)
            ? key.slice(descriptor.queryPrefix.length + 1, -1)
            : ''
          : key
        if (
          keys.some(
            (name) =>
              inner === name || inner.startsWith(`${name}[`) || inner.startsWith(`${name}][`)
          )
        )
          url.searchParams.delete(key)
      }
      const append = (key: string, value: unknown): void => {
        if (value && typeof value === 'object') {
          for (const [child, item] of Object.entries(value)) append(`${key}[${child}]`, item)
        } else if (value !== null && value !== undefined) {
          const name = descriptor.queryPrefix
            ? `${descriptor.queryPrefix}[${key.replaceAll(']', '').replaceAll('[', '][')}]`
            : key
          url.searchParams.set(name, String(value))
        }
      }
      for (const [key, value] of Object.entries({ ...view.query, view: view.id }))
        append(key, value)
      onColumns(view.columns ?? {})
      getRouter().visit(`${url.pathname}${url.search}`, {
        preserveState: true,
        preserveScroll: true,
      })
    },
    [descriptor.queryPrefix, onColumns]
  )
  useEffect(() => {
    let cancelled = false
    // Parent table effects restore localStorage first; the explicit view wins afterwards.
    if (active)
      queueMicrotask(() => {
        if (!cancelled) onColumns(active.columns ?? {})
      })
    return () => {
      cancelled = true
    }
  }, [active, onColumns])
  useEffect(() => {
    if (!descriptor.queryPrefix) return
    const prefix = `${descriptor.queryPrefix}[`
    if ([...currentUrl().searchParams.keys()].some((key) => key.startsWith(prefix))) return
    const defaultView =
      items.find((view) => view.source === 'mine' && view.isDefault) ??
      items.find((view) => view.source === 'preset' && view.isDefault)
    if (defaultView) apply(defaultView)
  }, [descriptor.queryPrefix, items, apply])
  const mutate = async (
    method: 'POST' | 'PUT' | 'DELETE',
    input?: {
      name: string
      query: Record<string, unknown>
      columns: Record<string, boolean>
      isPublic: boolean
      isDefault: boolean
    },
    view?: TableViewDescriptor
  ) => {
    if (!descriptor.views) return false
    setBusy(true)
    setError('')
    try {
      const response = await jsonFetch(
        `${descriptor.views.url}${view ? `/${encodeURIComponent(view.id)}` : ''}`,
        { method, ...(input ? { body: JSON.stringify(input) } : {}) }
      )
      if (!response.ok) {
        setError(
          response.status === 422 ? t('Invalid saved table view') : t('Unable to save table view')
        )
        return false
      }
      if (method === 'DELETE') setItems((current) => current.filter((item) => item.id !== view?.id))
      else {
        const saved = tableViewDescriptor.parse(await response.json())
        setItems((current) => [
          ...current
            .filter((item) => item.id !== saved.id)
            .map((item) =>
              saved.isDefault && item.source === 'mine' ? { ...item, isDefault: false } : item
            ),
          saved,
        ])
      }
      return true
    } catch {
      setError(t('Unable to save table view'))
      return false
    } finally {
      setBusy(false)
    }
  }
  return { items, active, apply, mutate, busy, error }
}
