import { useEffect, useRef, useState } from 'react'
import type { StateStore } from '@json-render/core'
import type { ActionDescriptor, ActionResult, PupitrePageProps } from '@rikology/pupitre/catalog'
import { fetchActionForm, submitAction } from '../bridge/actions.js'
import { mapErrors } from '../bridge/errors.js'
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
  onResult: (result: ActionResult) => void
}
export function ActionModal({
  action,
  ids,
  registry,
  runtimeRegistry,
  pupitre,
  close,
  toast,
  onResult,
}: ActionModalController) {
  const [formResponse, setFormResponse] = useState<{
    spec: PupitrePageProps['page']['spec']
    state: Record<string, unknown>
    catalogVersion: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, unknown>>({})
  const [modalStore, setModalStore] = useState<StateStore | null>(null)
  // Callers often pass inline `close`/`toast` callbacks; keep the latest ones in a
  // ref so a re-render never re-fetches the form (which would reset modal state).
  const callbacks = useRef({ close, toast })
  useEffect(() => {
    callbacks.current = { close, toast }
  })
  useEffect(() => {
    let active = true
    // The initial loading state is true; setting it here would synchronously rerender on mount.
    fetchActionForm(action)
      .then((result) => {
        if (active) setFormResponse(result)
      })
      .catch((error: unknown) => {
        if (active) {
          callbacks.current.toast({
            type: 'error',
            title: error instanceof Error ? error.message : 'Unable to load action form.',
          })
          callbacks.current.close()
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [action])
  const Modal = registry.Modal
  if (!Modal) return null
  const onSubmit = async () => {
    const data = (modalStore?.get('/data') ?? {}) as Record<string, unknown>
    setLoading(true)
    setErrors({})
    if (modalStore) modalStore.set('/errors', {})
    try {
      const actionResponse = await submitAction(action.url, { data, ids }, action.method)
      if (actionResponse.status === 200 && actionResponse.result) {
        onResult(actionResponse.result)
        close()
      } else if (actionResponse.status === 422 && actionResponse.errors) {
        setErrors(actionResponse.errors)
        if (modalStore) mapErrors(modalStore, actionResponse.errors)
      } else {
        toast({ type: 'error', title: actionResponse.message ?? 'Unable to perform action.' })
      }
    } catch {
      toast({ type: 'error', title: 'Unable to perform action.' })
    } finally {
      setLoading(false)
    }
  }
  const onStore = (store: StateStore) => setModalStore(store)
  const embedded = { submit: () => void onSubmit() }
  return (
    <Modal
      open={Boolean(formResponse)}
      onClose={close}
      heading={action.modal?.heading ?? action.label}
      description={action.modal?.description}
      width={action.modal?.width}
      slideOver={action.modal?.slideOver}
      footer={
        <button type="button" onClick={onSubmit} disabled={loading || !formResponse}>
          {action.modal?.submitLabel ?? action.label}
        </button>
      }
    >
      {formResponse && (
        <PupitreRenderer
          page={
            {
              key: `modal:${action.name}`,
              kind: 'custom',
              title: action.label,
              breadcrumbs: [],
              spec: formResponse.spec,
              state: formResponse.state as never,
              actions: { header: [] },
              catalogVersion: formResponse.catalogVersion,
            } as PupitrePageProps['page']
          }
          pupitre={pupitre}
          errors={errors}
          registry={runtimeRegistry}
          runAction={async () => {}}
          upload={async () => []}
          toast={toast}
          onStore={onStore}
          embedded={embedded}
        />
      )}
      {loading && !formResponse ? <span role="status">Loading…</span> : null}
    </Modal>
  )
}
