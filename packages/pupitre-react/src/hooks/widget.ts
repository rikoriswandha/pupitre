import { useCallback, useEffect, useRef, useState } from 'react'
import { actionResult, widgetData } from '@rikology/pupitre/catalog'
import type { ActionResult, WidgetDescriptor } from '@rikology/pupitre/catalog'
import { jsonFetch } from '../bridge/actions.js'
import { t } from '../i18n.js'

export type WidgetControls<T = unknown> = {
  data: T
  loading: boolean
  errors: Record<string, string[]>
  reload(params?: Record<string, unknown>): Promise<T>
  runAction(name: string, values?: Record<string, unknown>): Promise<ActionResult>
}

export class WidgetRequestError extends Error {
  constructor(
    readonly status: number,
    readonly errors: Record<string, string[]> = {},
    message = t('Unable to perform action ({status}).', { status })
  ) {
    super(message)
    this.name = 'WidgetRequestError'
  }
}

function widgetUrl(descriptor: WidgetDescriptor, extra: Record<string, unknown> = {}) {
  if (!descriptor.dataUrl) throw new Error('Widget does not have a data URL')
  const url = new URL(descriptor.dataUrl, window.location.origin)
  const context = new URLSearchParams(url.search)
  for (const [key, value] of new URLSearchParams(window.location.search))
    url.searchParams.set(key, value)
  for (const [key, value] of context) url.searchParams.set(key, value)
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === null) url.searchParams.delete(key)
    else url.searchParams.set(key, String(value))
  }
  return url
}

async function checkedResponse(response: Response) {
  const payload: unknown = await response.json()
  if (response.ok) return payload
  const errors: Record<string, string[]> = {}
  if (
    payload &&
    typeof payload === 'object' &&
    'errors' in payload &&
    payload.errors &&
    typeof payload.errors === 'object'
  ) {
    for (const [key, value] of Object.entries(payload.errors))
      if (Array.isArray(value) && value.every((item) => typeof item === 'string'))
        errors[key] = value
  }
  const message =
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof payload.message === 'string'
      ? payload.message
      : undefined
  throw new WidgetRequestError(response.status, errors, message)
}

/** Component widget data and JSON actions, retaining the server-issued page/record context. */
export function useWidget<T = unknown>(
  descriptor: WidgetDescriptor,
  initialData: T
): WidgetControls<T> {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [previousData, setPreviousData] = useState(initialData)
  const generation = useRef(0)
  const reloadParams = useRef<Record<string, unknown>>({})
  if (!Object.is(previousData, initialData)) {
    setPreviousData(initialData)
    setData(initialData)
    setLoading(false)
  }
  useEffect(() => {
    generation.current++
  }, [initialData])
  const reload = useCallback(
    async (params: Record<string, unknown> = reloadParams.current): Promise<T> => {
      setLoading(true)
      const requestGeneration = ++generation.current
      try {
        const response = await jsonFetch(widgetUrl(descriptor, params))
        const loaded = widgetData.parse(await checkedResponse(response))
        if (loaded.kind !== 'component') throw new Error('useWidget requires a component widget')
        // T is the host component's declared loader result; the envelope is validated above.
        const value = loaded.data as T
        if (requestGeneration === generation.current) {
          reloadParams.current = { ...params }
          setData(value)
        }
        return value
      } finally {
        if (requestGeneration === generation.current) setLoading(false)
      }
    },
    [descriptor]
  )
  const runAction = useCallback(
    async (name: string, values: Record<string, unknown> = {}): Promise<ActionResult> => {
      setErrors({})
      const url = widgetUrl(descriptor, reloadParams.current)
      url.pathname += `/actions/${encodeURIComponent(name)}`
      try {
        const response = await jsonFetch(url, {
          method: 'POST',
          headers: { 'X-Pupitre-Action': '1' },
          body: JSON.stringify({ data: values }),
        })
        return actionResult.parse(await checkedResponse(response))
      } catch (error) {
        if (error instanceof WidgetRequestError) setErrors(error.errors)
        throw error
      }
    },
    [descriptor]
  )
  return { data, loading, errors, reload, runAction }
}
