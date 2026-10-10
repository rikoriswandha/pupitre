/* eslint-disable @unicorn/filename-case */
import { useEffect, useState } from 'react'
import type { StateStore } from '@json-render/core'
import type { ActionDescriptor, PupitrePageProps } from '@rikology/pupitre/catalog'
import { getRouter } from '../bridge/inertia.js'
import { fetchActionForm } from '../bridge/actions.js'
import type { ShellRegistry } from '../shell/types.js'
import { PupitreRenderer } from './PupitreRenderer.js'
import type { PupitreRendererProps } from './PupitreRenderer.js'

export type ActionModalController = {
  action: ActionDescriptor
  ids?: Array<string | number>
  registry: ShellRegistry
  runtimeRegistry: PupitreRendererProps['registry']
  pupitre: PupitrePageProps['pupitre']
  close: () => void
  toast: PupitreRendererProps['toast']
}
export function ActionModal({
  action,
  ids,
  registry,
  runtimeRegistry,
  pupitre,
  close,
  toast,
}: ActionModalController) {
  const [response, setResponse] = useState<{
    spec: PupitrePageProps['page']['spec']
    state: Record<string, unknown>
    catalogVersion: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, unknown>>({})
  const [modalStore, setModalStore] = useState<StateStore | null>(null)
  useEffect(() => {
    let active = true
    // The initial loading state is true; setting it here would synchronously rerender on mount.
    fetchActionForm(action)
      .then((result) => {
        if (active) setResponse(result)
      })
      .catch((error: unknown) => {
        if (active) {
          toast({
            type: 'error',
            title: error instanceof Error ? error.message : 'Unable to load action form.',
          })
          close()
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [action, close, toast])
  const Modal = registry.Modal
  if (!Modal) return null
  const onSubmit = () => {
    const data = (modalStore?.get('/data') ?? {}) as Record<string, unknown>
    setLoading(true)
    getRouter().post(
      action.url,
      { data, ids },
      {
        preserveState: true,
        preserveScroll: true,
        headers: {
          'Accept': 'application/json',
          'X-Pupitre-Action': '1',
          'X-Requested-With': 'XMLHttpRequest',
        },
        onError: (responseErrors: Record<string, string>) => {
          const mapped: Record<string, unknown> = responseErrors
          setErrors(mapped)
          if (mapped._form) toast({ type: 'error', title: String(mapped._form) })
          else if (mapped.status === '403')
            toast({ type: 'error', title: 'You are not allowed to perform this action.' })
        },
        onHttpException: (exception: { status: number }) => {
          if (exception.status === 403)
            toast({ type: 'error', title: 'You are not allowed to perform this action.' })
        },
        onSuccess: () => close(),
        onFinish: () => setLoading(false),
      }
    )
  }
  const onStore = (store: StateStore) => setModalStore(store)
  return (
    <Modal
      open={Boolean(response)}
      onClose={close}
      heading={action.modal?.heading ?? action.label}
      description={action.modal?.description}
      width={action.modal?.width}
      slideOver={action.modal?.slideOver}
      footer={
        <button type="button" onClick={onSubmit} disabled={loading || !response}>
          {action.modal?.submitLabel ?? action.label}
        </button>
      }
    >
      {response && (
        <PupitreRenderer
          page={
            {
              key: `modal:${action.name}`,
              kind: 'custom',
              title: action.label,
              breadcrumbs: [],
              spec: response.spec,
              state: response.state as never,
              actions: { header: [] },
              catalogVersion: response.catalogVersion,
            } as PupitrePageProps['page']
          }
          pupitre={pupitre}
          errors={errors}
          registry={runtimeRegistry}
          runAction={async () => {}}
          upload={async () => []}
          toast={toast}
          onStore={onStore}
        />
      )}
      {loading && !response ? <span role="status">Loading…</span> : null}
    </Modal>
  )
}
