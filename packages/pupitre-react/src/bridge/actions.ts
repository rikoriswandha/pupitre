import type { RequestPayload } from '@inertiajs/core'
import type { StateStore } from '@json-render/core'
import { actionResult, fileUploadDescriptor } from '@rikology/pupitre/catalog'
import type {
  ActionDescriptor,
  FileUploadDescriptor,
  FormDescriptor,
  PupitrePageProps,
  UploadResponse,
} from '@rikology/pupitre/catalog'
import type { ActionResult } from '@rikology/pupitre/catalog'
import { mapErrors } from './errors.js'
import { currentUrl, getRouter } from './inertia.js'
import type { ToastMessage } from '../shell/types.js'
import type { JsonPatchOp } from '@rikology/pupitre/catalog'
type FetchLike = typeof fetch
let activeFetch: FetchLike = (...args) => globalThis.fetch(...args)
export function setFetch(fetcher: FetchLike): () => void {
  const previous = activeFetch
  activeFetch = fetcher
  return () => {
    activeFetch = previous
  }
}
function xsrfToken(): string {
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
export async function submitAction(
  url: string,
  body: { data?: Record<string, unknown>; ids?: Array<string | number> },
  method: ActionDescriptor['method'] = 'post'
): Promise<{
  status: number
  result?: ActionResult
  errors?: Record<string, unknown>
  message?: string
}> {
  const pageUrl =
    typeof window === 'undefined' ? '' : window.location.pathname + window.location.search
  const response = await activeFetch(url, {
    method: method.toUpperCase(),
    credentials: 'same-origin',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Pupitre-Action': '1',
      'X-Pupitre-Url': pageUrl,
      'X-XSRF-TOKEN': xsrfToken(),
    },
    body: JSON.stringify(body),
  })
  const payload: unknown = await response.json().catch(() => ({}))
  if (response.status === 200) {
    const parsed = actionResult.safeParse(payload)
    return parsed.success
      ? { status: response.status, result: parsed.data }
      : { status: response.status, message: 'Invalid action response.' }
  }
  if (response.status === 422 && payload && typeof payload === 'object' && 'errors' in payload) {
    const errors = payload.errors
    if (errors && typeof errors === 'object' && !Array.isArray(errors))
      return { status: response.status, errors: errors as Record<string, unknown> }
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
  return { status: response.status, message: `Unable to perform action (${response.status}).` }
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
  }
): void {
  for (const flash of result.flash) options.toast(flash)
  if (result.deselect) clearTableSelections()
  if (result.patch) options.setData(applyJsonPatch(options.data, result.patch))
  if (result.redirect) {
    const current = currentUrl()
    const destination = new URL(result.redirect, current)
    if (destination.href === current.href) getRouter().reload()
    else getRouter().visit(result.redirect)
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
  const root = page.spec.elements[page.spec.root] as
    { type?: string; props?: Record<string, unknown> } | undefined
  return root?.type === 'Form' && root.props ? (root.props as unknown as FormDescriptor) : undefined
}
export function submitForm(
  page: PupitrePageProps['page'],
  store: StateStore,
  toast: (message: { type: 'error'; title: string }) => void
): void {
  const form = getFormDescriptor(page)
  if (!form) throw new Error('The page spec root must be a Form to submit it.')
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
      else if (first && typeof document !== 'undefined')
        document.getElementsByName(first)[0]?.focus()
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
    throw new Error(`Unable to load action form (${response.status}).`)
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
        : `Upload failed (${response.status}).`
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
  if (!response.ok) throw new Error(`Upload removal failed (${response.status}).`)
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
