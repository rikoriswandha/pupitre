import { useEffect, useRef, useState } from 'react'
import type { StateStore } from '@json-render/core'
import type { ActionDescriptor, ActionResult, PupitrePageProps } from '@rikology/pupitre/catalog'
import { fetchActionForm, submitAction } from '../bridge/actions.js'
import { mapErrors } from '../bridge/errors.js'
import { getRouter } from '../bridge/inertia.js'
import type { ShellRegistry } from '../shell/types.js'
import { PupitreRenderer } from './PupitreRenderer.js'
import type { PupitreRendererProps } from './PupitreRenderer.js'
import { t } from '../i18n.js'
import type { ActionFormResponse } from '@rikology/pupitre/catalog'
import { assertCatalogComponents } from './missing_component.js'

function wizardFor(spec: PupitrePageProps['page']['spec']) {
  return Object.entries(spec.elements).find(([, element]) => element.type === 'Wizard')
}
function fieldsInStep(spec: PupitrePageProps['page']['spec'], stepId: string): string[] {
  const names: string[] = []
  const visit = (id: string) => {
    const element = spec.elements[id] as
      { props?: Record<string, unknown>; children?: string[] } | undefined
    if (!element) return
    if (typeof element.props?.name === 'string') names.push(element.props.name)
    for (const child of element.children ?? []) visit(child)
  }
  visit(stepId)
  return names
}
export type ActionModalController = {
  action: ActionDescriptor
  ids?: Array<string | number>
  registry: ShellRegistry
  runtimeRegistry: PupitreRendererProps['registry']
  pupitre: PupitrePageProps['pupitre']
  close: () => void
  toast: PupitreRendererProps['toast']
  onResult: (result: ActionResult) => void
  onOptionCreated?: (option: { value: string | number; label: string }) => void
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
  onOptionCreated,
}: ActionModalController) {
  const [formResponse, setFormResponse] = useState<ActionFormResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, unknown>>({})
  const [modalStore, setModalStore] = useState<StateStore | null>(null)
  const [pendingFooterAction, setPendingFooterAction] = useState<
    NonNullable<NonNullable<ActionDescriptor['modal']>['footerActions']>[number] | null
  >(null)
  const [wizardStepOverride, setWizardStepOverride] = useState<{
    spec: PupitrePageProps['page']['spec']
    step: number
  } | null>(null)
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
            title: error instanceof Error ? error.message : t('Unable to load action form.'),
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
  if (formResponse) assertCatalogComponents(formResponse, runtimeRegistry)
  const Modal = registry.Modal
  if (!Modal) return null
  const wizardEntry = formResponse ? wizardFor(formResponse.spec) : undefined
  const wizardProps = wizardEntry?.[1].props as
    { id?: string; submitLabel?: string; steps?: { key: string; fields?: string[] }[] } | undefined
  const wizardSteps = wizardProps?.steps ?? []
  const wizardStatePath = wizardProps?.id ? `/ui/wizard/${wizardProps.id}/step` : undefined
  const wizardInitial = formResponse?.state.ui as
    { wizard?: Record<string, { step?: number }> } | undefined
  const wizardStep =
    wizardStepOverride && wizardStepOverride.spec === formResponse?.spec
      ? wizardStepOverride.step
      : wizardStatePath
        ? Number(
            modalStore?.get(wizardStatePath) ??
              wizardInitial?.wizard?.[wizardProps?.id ?? '']?.step ??
              0
          )
        : 0
  const wizardStepElements = wizardEntry
    ? (wizardEntry[1].children ?? []).map(
        (id) => formResponse!.spec.elements[id] as { props?: Record<string, unknown> } | undefined
      )
    : []
  const selectWizardStep = (step: number) => {
    const next = Math.max(0, Math.min(wizardSteps.length - 1, step))
    if (formResponse) setWizardStepOverride({ spec: formResponse.spec, step: next })
    if (wizardStatePath && modalStore) modalStore.set(wizardStatePath, next)
  }
  const onSubmit = async () => {
    if (wizardEntry && wizardStep < wizardSteps.length - 1) {
      selectWizardStep(wizardStep + 1)
      return
    }
    const data = (modalStore?.get('/data') ?? {}) as Record<string, unknown>
    setLoading(true)
    setErrors({})
    if (modalStore) modalStore.set('/errors', {})
    try {
      const actionResponse = await submitAction(action.url, { data, ids }, action.method)
      if (actionResponse.status === 200 && actionResponse.option) {
        onOptionCreated?.(actionResponse.option)
        close()
      } else if (actionResponse.status === 200 && actionResponse.result) {
        onResult(actionResponse.result)
        close()
      } else if (actionResponse.status === 422 && actionResponse.errors) {
        setErrors(actionResponse.errors)
        if (modalStore) mapErrors(modalStore, actionResponse.errors)
        const firstInvalidStep = wizardStepElements.findIndex((_stepElement, index) => {
          const fields = wizardEntry
            ? fieldsInStep(formResponse!.spec, wizardEntry[1].children?.[index] ?? '')
            : []
          return Object.keys(actionResponse.errors!).some((errorPath) =>
            fields.some((field) => errorPath === field || errorPath.startsWith(`${field}.`))
          )
        })
        if (firstInvalidStep >= 0) selectWizardStep(firstInvalidStep)
      } else {
        toast({ type: 'error', title: actionResponse.message ?? t('Unable to perform action.') })
      }
    } catch {
      toast({ type: 'error', title: t('Unable to perform action.') })
    } finally {
      setLoading(false)
    }
  }
  const runFooterAction = async (
    footerAction: NonNullable<NonNullable<ActionDescriptor['modal']>['footerActions']>[number],
    confirmed = false
  ) => {
    if (!footerAction.enabled) return
    if (footerAction.kind === 'link') {
      close()
      getRouter().visit(footerAction.url, { method: footerAction.method ?? 'get' })
      return
    }
    if (footerAction.kind === 'confirm' && !confirmed) {
      setPendingFooterAction(footerAction)
      return
    }
    setLoading(true)
    try {
      const data = (modalStore?.get('/data') ?? {}) as Record<string, unknown>
      const response = await submitAction(footerAction.url, { data, ids }, footerAction.method)
      if (response.result) {
        onResult(response.result)
        close()
      } else {
        toast({ type: 'error', title: response.message ?? t('Unable to perform action.') })
      }
    } catch {
      toast({ type: 'error', title: t('Unable to perform action.') })
    } finally {
      setLoading(false)
    }
  }
  const onStore = (store: StateStore) => setModalStore(store)
  const embedded = { submit: () => void onSubmit() }
  const ConfirmDialog = registry.ConfirmDialog
  return (
    <>
      <Modal
        open={Boolean(formResponse)}
        onClose={close}
        heading={action.modal?.heading ?? action.label}
        description={action.modal?.description}
        width={action.modal?.width}
        slideOver={action.modal?.slideOver}
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {action.modal?.cancel !== false && (
                <button
                  className="inline-flex h-(--control-h) items-center justify-center rounded-lg border border-input bg-card px-3.5 text-sm font-medium text-foreground shadow-control outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
                  type="button"
                  onClick={close}
                  disabled={loading}
                >
                  {action.modal?.cancelLabel ?? t('Cancel')}
                </button>
              )}
              {wizardEntry && wizardStep > 0 ? (
                <button
                  type="button"
                  className="inline-flex h-(--control-h) items-center justify-center rounded-lg border border-input bg-card px-3.5 text-sm font-medium text-foreground shadow-control outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => selectWizardStep(wizardStep - 1)}
                  disabled={loading}
                >
                  {t('Back')}
                </button>
              ) : null}
              {action.modal?.footerActions?.map((footerAction) => (
                <button
                  key={footerAction.name}
                  type="button"
                  className="inline-flex min-h-8 items-center justify-center rounded-lg px-2 text-[0.8125rem] font-medium text-primary-ink outline-none transition-colors hover:bg-primary-soft focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => void runFooterAction(footerAction)}
                  disabled={loading || !footerAction.enabled}
                >
                  {footerAction.label}
                </button>
              ))}
            </div>
            {(wizardEntry && wizardStep < wizardSteps.length - 1) ||
            action.modal?.submit !== false ? (
              <button
                type="button"
                className={`inline-flex h-(--control-h) items-center justify-center rounded-lg px-3.5 text-sm font-medium shadow-control outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 ${action.color === 'danger' || action.confirm?.destructive ? 'bg-danger text-danger-foreground hover:bg-danger/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                onClick={() => void onSubmit()}
                disabled={loading || !formResponse}
              >
                {wizardEntry && wizardStep < wizardSteps.length - 1
                  ? t('Next')
                  : (wizardProps?.submitLabel ?? action.modal?.submitLabel ?? action.label)}
              </button>
            ) : null}
          </div>
        }
      >
        {formResponse && (
          <PupitreRenderer
            page={
              {
                key: formResponse.uploadOwner
                  ? `${pupitre.panel.id}:${formResponse.uploadOwner.resource}:modal:${formResponse.uploadOwner.record ?? ''}`
                  : `modal:${action.name}`,
                kind: 'custom',
                title: action.label,
                breadcrumbs: [],
                spec: formResponse.spec,
                state: formResponse.state as never,
                actions: { header: [] },
                catalogVersion: formResponse.catalogVersion,
                catalogExtensions: formResponse.catalogExtensions,
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
        {loading && !formResponse ? <span role="status">{t('Loading…')}</span> : null}
      </Modal>
      {ConfirmDialog && pendingFooterAction && (
        <ConfirmDialog
          open
          heading={pendingFooterAction.confirm?.heading ?? pendingFooterAction.label}
          description={pendingFooterAction.confirm?.description}
          onConfirm={() => {
            const confirmedAction = pendingFooterAction
            setPendingFooterAction(null)
            void runFooterAction(confirmedAction, true)
          }}
          onCancel={() => setPendingFooterAction(null)}
        />
      )}
    </>
  )
}
