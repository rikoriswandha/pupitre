import type { RequestPayload } from '@inertiajs/core'
import type { StateStore } from '@json-render/core'
import {
  actionResult,
  fileUploadDescriptor,
  option as optionSchema,
} from '@rikology/pupitre/catalog'
import { exportJobResponse } from '@rikology/pupitre/catalog'
import { exportProgressResponse } from '@rikology/pupitre/catalog'
import type {
  ActionDescriptor,
  FileUploadDescriptor,
  FormDescriptor,
  PupitrePageProps,
  UploadResponse,
} from '@rikology/pupitre/catalog'
import type { ExportJobResponse } from '@rikology/pupitre/catalog'
import type { ExportProgressResponse } from '@rikology/pupitre/catalog'
import type { ActionResult } from '@rikology/pupitre/catalog'
import { mapErrors } from './errors.js'
import { currentUrl, getRouter } from './inertia.js'
import type { ToastMessage } from '../shell/types.js'
import type { JsonPatchOp } from '@rikology/pupitre/catalog'
import { t } from '../i18n.js'
type FetchLike = typeof fetch
let activeFetch: FetchLike = (...args) => globalThis.fetch(...args)
export function setFetch(fetcher: FetchLike): () => void {
  const previous = activeFetch
  activeFetch = fetcher
  return () => {
    activeFetch = previous
  }
}
let pendingActionToasts: Omit<ToastMessage, 'id'>[] = []

export function takePendingActionToasts(): Omit<ToastMessage, 'id'>[] {
  const pending = pendingActionToasts
  pendingActionToasts = []
  return pending
}
export function xsrfToken(): string {
  if (typeof document === 'undefined') return ''
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('XSRF-TOKEN='))
  if (!cookie) return ''
  try {
    return decodeURIComponent(cookie.slice('XSRF-TOKEN='.length))
  } catch {
    return cookie.slice('XSRF-TOKEN='.length)
  }
}

export function jsonFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const request = input instanceof Request ? input : undefined
  const method = (init.method ?? request?.method ?? 'GET').toUpperCase()
  const sourceHeaders = init.headers ?? request?.headers
  const headers: Record<string, string> =
    sourceHeaders && !Array.isArray(sourceHeaders) && !(sourceHeaders instanceof Headers)
      ? { ...sourceHeaders }
      : Object.fromEntries(new Headers(sourceHeaders).entries())
  const existingHeaders = new Headers(headers)
  if (!existingHeaders.has('Accept')) headers.Accept = 'application/json'
  if (typeof init.body === 'string' && !existingHeaders.has('Content-Type'))
    headers['Content-Type'] = 'application/json'
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !existingHeaders.has('X-XSRF-TOKEN'))
    headers['X-XSRF-TOKEN'] = xsrfToken()
  return activeFetch(input, {
    ...init,
    credentials: init.credentials ?? 'same-origin',
    headers,
  })
}
function isExportResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type') ?? ''
  return (
    contentType.includes('text/csv') ||
    contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  )
}
async function saveExportResponse(response: Response, signal?: AbortSignal): Promise<void> {
  const blob = await response.blob()
  signal?.throwIfAborted()
  const blobUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  const disposition = response.headers.get('content-disposition')
  anchor.download = disposition?.match(/filename="([^"]+)"/)?.[1] ?? 'export.csv'
  anchor.click()
  URL.revokeObjectURL(blobUrl)
}
export async function downloadExportFile(url: string, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted()
  const response = await jsonFetch(url, {
    signal,
    headers: {
      Accept: 'text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  })
  if (!response.ok)
    throw new Error(t('Export download failed ({status})', { status: response.status }))
  if (!isExportResponse(response))
    throw new Error(t('Export download did not return a supported file.'))
  await saveExportResponse(response, signal)
}
export async function submitAction(
  url: string,
  body: { data?: Record<string, unknown>; ids?: Array<string | number>; format?: 'csv' | 'xlsx' },
  method: ActionDescriptor['method'] = 'post'
): Promise<{
  status: number
  result?: ActionResult
  option?: Option
  errors?: Record<string, unknown>
  retryAfter?: number
  message?: string
  exportJob?: ExportJobResponse
  downloaded?: boolean
}> {
  let pageUrl = ''
  if (typeof window !== 'undefined') {
    const pageAddress = new URL(window.location.href)
    pageAddress.searchParams.delete('action')
    pageAddress.searchParams.delete('record')
    pageUrl = pageAddress.pathname + pageAddress.search
  }
  const response = await jsonFetch(url, {
    method: method.toUpperCase(),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Pupitre-Action': '1',
      'X-Pupitre-Url': pageUrl,
    },
    body: JSON.stringify(body),
  })
  if (response.ok && isExportResponse(response)) {
    await saveExportResponse(response)
    return { status: response.status, downloaded: true }
  }
  const payload: unknown = await response.json().catch(() => ({}))
  if (response.status === 200) {
    const exportJob = exportJobResponse.safeParse(payload)
    if (exportJob.success) return { status: response.status, exportJob: exportJob.data }
    const parsedOption =
      payload && typeof payload === 'object' && 'option' in payload
        ? optionSchema.safeParse(payload.option)
        : undefined
    const option = parsedOption?.success ? parsedOption.data : undefined
    const parsed = actionResult.safeParse(payload)
    return parsed.success
      ? { status: response.status, result: parsed.data, ...(option ? { option } : {}) }
      : option
        ? { status: response.status, option }
        : { status: response.status, message: t('Invalid action response.') }
  }
  if (response.status === 422 && payload && typeof payload === 'object' && 'errors' in payload) {
    const errors = payload.errors
    if (errors && typeof errors === 'object' && !Array.isArray(errors))
      return { status: response.status, errors: errors as Record<string, unknown> }
  }
  if (response.status === 429 && payload && typeof payload === 'object' && 'message' in payload) {
    const message = payload.message
    const retryAfter =
      'retryAfter' in payload && typeof payload.retryAfter === 'number'
        ? payload.retryAfter
        : undefined
    if (typeof message === 'string')
      return { status: response.status, message, ...(retryAfter ? { retryAfter } : {}) }
  }
  if (
    (response.status === 403 || response.status === 404) &&
    payload &&
    typeof payload === 'object' &&
    'message' in payload
  ) {
    const message = payload.message
    if (typeof message === 'string') return { status: response.status, message }
  }
  return {
    status: response.status,
    message: t('Unable to perform action ({status}).', { status: response.status }),
  }
}
export async function waitForExport(
  job: { progressUrl: string },
  onProgress?: (progress: ExportProgressResponse) => void,
  options: { signal?: AbortSignal; maxDurationMs?: number } = {}
): Promise<ExportProgressResponse> {
  const signal = options.signal
  const deadline = Date.now() + (options.maxDurationMs ?? 5 * 60_000)
  while (true) {
    if (signal?.aborted)
      throw signal.reason ?? new DOMException('Export polling was cancelled.', 'AbortError')
    if (Date.now() >= deadline)
      throw new Error(t('Export did not finish before the polling deadline.'))
    const response = await jsonFetch(job.progressUrl, {
      headers: { Accept: 'application/json' },
      signal,
    })
    if (!response.ok)
      throw new Error(t('Export progress request failed ({status})', { status: response.status }))
    const progress = exportProgressResponse.safeParse(await response.json())
    if (!progress.success) throw new Error(t('Invalid export progress response.'))
    onProgress?.(progress.data)
    if (progress.data.status === 'done') return progress.data
    if (progress.data.status === 'failed')
      throw new Error(progress.data.error ?? t('Export failed.'))
    const delay = Math.min(1500, Math.max(0, deadline - Date.now()))
    await new Promise<void>((resolve, reject) => {
      const finish = () => {
        signal?.removeEventListener('abort', abort)
        resolve()
      }
      const timer = setTimeout(finish, delay)
      const abort = () => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
        reject(signal?.reason ?? new DOMException('Export polling was cancelled.', 'AbortError'))
      }
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) abort()
    })
  }
}
const tableSelectionClearers = new Set<() => void>()
export function registerTableSelectionClearer(clear: () => void): () => void {
  tableSelectionClearers.add(clear)
  return () => tableSelectionClearers.delete(clear)
}
export function clearTableSelections(): void {
  for (const clear of tableSelectionClearers) clear()
}
export function handleActionResult(
  result: ActionResult,
  options: {
    data: unknown
    pageKind: PupitrePageProps['page']['kind']
    toast: (message: Omit<ToastMessage, 'id'>) => void
    setData: (data: unknown) => void
    onNavigationComplete?: () => void
  }
): void {
  const current = currentUrl()
  const destination = result.redirect ? new URL(result.redirect, current) : null
  const navigates = destination !== null && destination.href !== current.href
  for (const flash of result.flash) {
    if (navigates) pendingActionToasts.push(flash)
    else options.toast(flash)
  }
  if (result.deselect) clearTableSelections()
  if (result.patch) options.setData(applyJsonPatch(options.data, result.patch))
  if (destination) {
    if (destination.href === current.href) getRouter().reload()
    else
      getRouter().visit(destination.href, {
        onSuccess: () => options.onNavigationComplete?.(),
      })
    return
  }
  if (result.patch) {
    getRouter().reload({ only: ['data'] })
    return
  }
  if (result.reload) {
    if (options.pageKind === 'list') getRouter().reload({ only: ['data'] })
    else getRouter().reload()
  }
}
export function applyJsonPatch<T>(value: T, patch: JsonPatchOp[]): T {
  const root = structuredClone(value) as unknown
  const parts = (path: string) =>
    path
      .split('/')
      .slice(1)
      .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
  const getParent = (path: string) => {
    const keys = parts(path)
    const key = keys.pop()
    let parent = root as Record<string, unknown>
    for (const part of keys) parent = parent[part] as Record<string, unknown>
    return { parent, key: key ?? '' }
  }
  for (const op of patch) {
    const { parent, key } = getParent(op.path)
    if (op.op === 'remove') {
      if (Array.isArray(parent)) parent.splice(Number(key), 1)
      else delete parent[key]
    } else if (op.op === 'move' || op.op === 'copy') {
      const from = getParent(op.from)
      const item = Array.isArray(from.parent)
        ? from.parent[Number(from.key)]
        : from.parent[from.key]
      if (op.op === 'move') {
        if (Array.isArray(from.parent)) from.parent.splice(Number(from.key), 1)
        else delete from.parent[from.key]
      }
      if (Array.isArray(parent)) parent.splice(key === '-' ? parent.length : Number(key), 0, item)
      else parent[key] = item
    } else if (op.op === 'add' && Array.isArray(parent)) {
      parent.splice(key === '-' ? parent.length : Number(key), 0, op.value)
    } else if (op.op === 'test') {
      const current = Array.isArray(parent) ? parent[Number(key)] : parent[key]
      if (JSON.stringify(current) !== JSON.stringify(op.value))
        throw new Error(`JSON patch test failed at ${op.path}.`)
    } else if ('value' in op) parent[key] = op.value
  }
  return root as T
}
export type Option = {
  value: string | number
  label: string
  description?: string
  disabled?: boolean
}
export async function fetchOptions(
  url: string,
  params: {
    search?: string
    selected?: Array<string | number>
    page?: number
    signal?: AbortSignal
  }
): Promise<{ options: Option[]; hasMore: boolean }> {
  const parsed = new URL(url, 'http://pupitre.local')
  if (params.search) parsed.searchParams.set('q', params.search)
  for (const value of params.selected ?? []) parsed.searchParams.append('selected[]', String(value))
  if (params.page) parsed.searchParams.set('page', String(params.page))
  const response = await activeFetch(`${parsed.pathname}${parsed.search}`, {
    headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    credentials: 'same-origin',
    signal: params.signal,
  })
  if (!response.ok)
    throw new Error(t('Options request failed ({status})', { status: response.status }))
  const result = (await response.json()) as { options?: Option[]; hasMore?: boolean }
  return {
    options: Array.isArray(result.options) ? result.options : [],
    hasMore: result.hasMore === true,
  }
}

export function visit(params: Record<string, unknown>): void {
  const router = getRouter()
  router.visit(String(params.url ?? ''), {
    method: (params.method as 'get' | 'post' | 'put' | 'patch' | 'delete') ?? 'get',
    data: params.data as RequestPayload | undefined,
    preserveScroll: Boolean(params.preserveScroll),
  })
}
export function reload(params: Record<string, unknown>): void {
  getRouter().reload({
    only: Array.isArray(params.only) ? (params.only as string[]) : [],
    data: params.data as RequestPayload | undefined,
  })
}
export function getFormDescriptor(page: PupitrePageProps['page']): FormDescriptor | undefined {
  const pending = [page.spec.root]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const key = pending.pop()!
    if (visited.has(key)) continue
    visited.add(key)
    const element = page.spec.elements[key]
    if (!element) continue
    if (element.type === 'Form') return element.props as unknown as FormDescriptor
    if (element.children)
      for (let index = element.children.length - 1; index >= 0; index--)
        pending.push(element.children[index])
  }
  return undefined
}
export function submitForm(
  page: PupitrePageProps['page'],
  store: StateStore,
  toast: (message: { type: 'error'; title: string }) => void
): void {
  const form = getFormDescriptor(page)
  if (!form) throw new Error('The page spec must contain a Form to submit it.')
  const state = store.getSnapshot() as Record<string, unknown>
  const data = (state.data ?? {}) as Record<string, unknown>
  store.set('/meta/submitting', true)
  store.set('/errors', {})
  store.set('/meta/submitted', false)
  getRouter()[form.method](form.url, data as RequestPayload, {
    preserveState: true,
    preserveScroll: true,
    onSuccess: () => {
      store.set('/meta/submitted', true)
    },
    onError: (errors: Record<string, string>) => {
      mapErrors(store, errors)
      const first = Object.keys(errors)[0]
      if (first === '_form') toast({ type: 'error', title: String(errors[first]) })
      else if (first && typeof document !== 'undefined') {
        const field = document.getElementsByName(first)[0]
        const compositeControl =
          field instanceof HTMLInputElement && field.getAttribute('aria-hidden') === 'true'
            ? field.parentElement?.querySelector<HTMLElement>(
                '[role="checkbox"], [role="radio"], [role="switch"]'
              )
            : null
        ;(compositeControl ?? field)?.focus()
      }
    },
    onFinish: () => store.set('/meta/submitting', false),
  })
}
export type ActionModalState = {
  action: ActionDescriptor
  response: {
    spec: PupitrePageProps['page']['spec']
    state: Record<string, unknown>
    catalogVersion: string
  }
  ids?: Array<string | number>
}
export async function fetchActionForm(
  action: ActionDescriptor
): Promise<ActionModalState['response']> {
  const response = await activeFetch(action.url, {
    headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
  })
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    if (
      (response.status === 403 || response.status === 404) &&
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
    )
      throw new Error(payload.message)
    throw new Error(t('Unable to load action form ({status}).', { status: response.status }))
  }
  return (await response.json()) as ActionModalState['response']
}
export function findUploadDescriptor(
  page: PupitrePageProps['page'],
  field: string
): FileUploadDescriptor | undefined {
  for (const element of Object.values(page.spec.elements)) {
    if (!element || typeof element !== 'object' || !('type' in element) || !('props' in element))
      continue
    if (
      element.type !== 'FileUpload' ||
      !element.props ||
      typeof element.props !== 'object' ||
      !('descriptor' in element.props)
    )
      continue
    const descriptor = fileUploadDescriptor.safeParse(element.props.descriptor)
    if (descriptor.success && descriptor.data.name === field) return descriptor.data
  }
  return undefined
}
/**
 * Resource slug and record id from `page.key`
 * (`${panel}:${resource}:${page}:${recordId}:${tenant}`): the server checks the
 * `create` ability without a record and `update` with one.
 */
function uploadContext(pageKey: string) {
  const [, resource = '', , record = ''] = pageKey.split(':')
  return { resource, record }
}
export async function uploadFile(
  descriptor: FileUploadDescriptor,
  file: File,
  pageKey: string
): Promise<UploadResponse> {
  const { resource, record } = uploadContext(pageKey)
  const body = new FormData()
  body.append('file', file)
  body.append('field', descriptor.name)
  body.append('resource', resource)
  if (record) body.append('record', record)
  const response = await activeFetch(descriptor.uploadUrl, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-XSRF-TOKEN': xsrfToken(),
    },
    body,
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : t('Upload failed ({status}).', { status: response.status })
    throw new Error(message)
  }
  return payload as UploadResponse
}
export async function deleteUpload(
  descriptor: FileUploadDescriptor,
  key: string,
  pageKey: string
): Promise<void> {
  const { resource } = uploadContext(pageKey)
  const response = await activeFetch(descriptor.deleteUrl, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-XSRF-TOKEN': xsrfToken(),
    },
    body: JSON.stringify({ key, field: descriptor.name, resource }),
  })
  if (!response.ok)
    throw new Error(t('Upload removal failed ({status}).', { status: response.status }))
}
export async function uploadFiles(
  descriptor: FileUploadDescriptor,
  files: File[],
  pageKey: string
): Promise<UploadResponse[]> {
  const results: UploadResponse[] = []
  for (const file of files) results.push(await uploadFile(descriptor, file, pageKey))
  return results
}
export async function runAction(params: Record<string, unknown>): Promise<void> {
  await submitAction(
    String(params.url ?? ''),
    {
      data:
        params.data && typeof params.data === 'object'
          ? (params.data as Record<string, unknown>)
          : undefined,
      ids: params.ids as Array<string | number> | undefined,
    },
    (params.method as ActionDescriptor['method'] | undefined) ?? 'post'
  )
}
