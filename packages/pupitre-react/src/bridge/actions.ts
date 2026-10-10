import type { StateStore } from '@json-render/core'
import { fileUploadDescriptor } from '@rikology/pupitre/catalog'
import type {
  ActionDescriptor,
  FileUploadDescriptor,
  FormDescriptor,
  PupitrePageProps,
  UploadResponse,
} from '@rikology/pupitre/catalog'
import { getRouter } from './inertia.js'
import { mapErrors } from './errors.js'

export function visit(params: Record<string, unknown>): void {
  const router = getRouter()
  router.visit(String(params.url ?? ''), {
    method: (params.method as 'get' | 'post' | 'put' | 'patch' | 'delete') ?? 'get',
    data: params.data as Record<string, unknown> | undefined,
    preserveScroll: Boolean(params.preserveScroll),
  })
}
export function reload(params: Record<string, unknown>): void {
  getRouter().reload({
    only: Array.isArray(params.only) ? (params.only as string[]) : [],
    data: params.data as Record<string, unknown> | undefined,
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
  getRouter()[form.method](form.url, data, {
    preserveState: true,
    preserveScroll: true,
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
  const response = await fetch(action.url, {
    headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
  })
  if (!response.ok) throw new Error(`Unable to load action form (${response.status}).`)
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
export async function uploadFiles(
  descriptor: FileUploadDescriptor,
  files: File[],
  pageKey: string
): Promise<UploadResponse[]> {
  const resource = pageKey.split(':')[1] ?? ''
  const results: UploadResponse[] = []
  for (const file of files) {
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
    results.push((await response.json()) as UploadResponse)
  }
  return results
}
export function runAction(params: Record<string, unknown>): void {
  const url = String(params.url ?? '')
  const method = (params.method as 'get' | 'post' | 'put' | 'patch' | 'delete') ?? 'post'
  getRouter()[method](url, { ids: params.ids as Array<string | number> | undefined })
}
