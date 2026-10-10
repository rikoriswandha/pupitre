/* eslint-disable @unicorn/filename-case */
import { useCallback, useEffect, useState } from 'react'
import { usePage as useInertiaPage } from '@inertiajs/react'
import type { ActionDescriptor, PupitrePageProps } from '@rikology/pupitre/catalog'
import { findUploadDescriptor, uploadFiles } from '../bridge/actions.js'
import { catalogVersion } from '@rikology/pupitre/catalog'
import { t } from '../i18n.js'
import type { PupitreRegistry } from '../registry/defineRegistry.js'
import type { ToastMessage } from '../shell/types.js'
import { PupitreRenderer } from '../renderer/PupitreRenderer.js'
import { ActionModal } from '../renderer/ActionModal.js'
import { getRouter } from '../bridge/inertia.js'

type InertiaPupitreProps = PupitrePageProps & { errors?: Record<string, string> }
export type PupitreProps = { registry: PupitreRegistry }
let toastId = 0
function major(version: string): string {
  return version.split('.')[0] ?? ''
}
function useInertiaPropsSafely(): InertiaPupitreProps | null {
  try {
    return useInertiaPage<InertiaPupitreProps>().props
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'usePage must be used within the Inertia component'
    )
      return null
    throw error
  }
}
export function Pupitre({ registry }: PupitreProps) {
  const props = useInertiaPropsSafely()
  if (!props) return null
  return <PupitreContent registry={registry} props={props} />
}
function PupitreContent({
  registry,
  props,
}: {
  registry: PupitreRegistry
  props: InertiaPupitreProps
}) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [confirm, setConfirm] = useState<{
    action: ActionDescriptor
    ids?: Array<string | number>
  } | null>(null)
  const [formAction, setFormAction] = useState<{
    action: ActionDescriptor
    ids?: Array<string | number>
  } | null>(null)
  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    setToasts((current) => [...current, { ...toast, id: String(++toastId) }])
  }, [])
  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])
  const page = props.page
  const panel = props.pupitre
  useEffect(() => {
    if (typeof document !== 'undefined') document.title = page.title
  }, [page])
  useEffect(() => {
    if (major(page.catalogVersion) !== major(catalogVersion)) {
      queueMicrotask(() => pushToast({ type: 'warning', title: t('Reload required') }))
      getRouter().reload()
    }
  }, [page, pushToast])
  useEffect(() => {
    const timeout = setTimeout(() => {
      for (const flash of panel.flash) pushToast(flash)
    }, 0)
    return () => clearTimeout(timeout)
  }, [panel.flash, pushToast])
  const runAction = useCallback(
    async (
      action: ActionDescriptor,
      options: { ids?: Array<string | number>; record?: Record<string, unknown> } = {}
    ) => {
      if (!action.enabled) return
      if (action.kind === 'link') {
        if (action.openInNewTab && typeof window !== 'undefined')
          window.open(action.url, '_blank', 'noopener,noreferrer')
        else getRouter().visit(action.url)
      } else if (action.kind === 'confirm') setConfirm({ action, ids: options.ids })
      else if (action.kind === 'form') setFormAction({ action, ids: options.ids })
      else getRouter()[action.method ?? 'post'](action.url, { ids: options.ids })
    },
    []
  )
  const closeAction = useCallback(() => setFormAction(null), [])
  const submitConfirm = () => {
    if (!confirm) return
    const { action, ids } = confirm
    getRouter()[action.method ?? 'post'](
      action.url,
      { ids },
      {
        onSuccess: () => setConfirm(null),
        onError: (errors: Record<string, string>) =>
          pushToast({ type: 'error', title: String(errors._form ?? 'Unable to perform action.') }),
        onHttpException: (response: { status: number }) => {
          if (response.status === 403)
            pushToast({ type: 'error', title: 'You are not allowed to perform this action.' })
        },
      }
    )
  }
  const ShellComponent = registry.shell.Shell
  const Toaster = registry.shell.Toaster
  const NotFound = registry.shell.NotFound
  if (page.kind === 'custom') return null
  if (major(page.catalogVersion) !== major(catalogVersion))
    return <Toaster toasts={toasts} dismiss={dismiss} />
  const content = page.spec ? (
    <PupitreRenderer
      page={page}
      data={props.data}
      errors={props.errors}
      pupitre={panel}
      registry={registry}
      runAction={runAction}
      upload={async (field, files) => {
        const descriptor = findUploadDescriptor(page, field)
        if (!descriptor) throw new Error(`No upload descriptor exists for field "${field}".`)
        return uploadFiles(descriptor, files, page.key)
      }}
      toast={pushToast}
    />
  ) : (
    <NotFound title={t('Not found')} message={t('The requested page could not be found.')} />
  )
  const main = (
    <ShellComponent
      panel={panel.panel}
      user={panel.user}
      nav={panel.nav}
      breadcrumbs={page.breadcrumbs}
      title={page.title}
      headerActions={page.actions?.header ?? []}
      currentUrl={
        typeof window === 'undefined' ? '' : window.location.pathname + window.location.search
      }
    >
      {content}
    </ShellComponent>
  )
  const Confirm = registry.shell.ConfirmDialog
  const modal = confirm ? (
    <Confirm
      open
      heading={confirm.action.confirm?.heading ?? confirm.action.label}
      description={confirm.action.confirm?.description}
      submitLabel={confirm.action.confirm?.submitLabel}
      cancelLabel={confirm.action.confirm?.cancelLabel}
      destructive={confirm.action.confirm?.destructive}
      icon={confirm.action.confirm?.icon}
      onConfirm={submitConfirm}
      onCancel={() => setConfirm(null)}
    />
  ) : null
  const actionModal = formAction ? (
    <ActionModal
      action={formAction.action}
      ids={formAction.ids}
      registry={registry.shell}
      runtimeRegistry={registry}
      pupitre={panel}
      close={closeAction}
      toast={pushToast}
    />
  ) : null
  return (
    <>
      {main}
      {modal}
      {actionModal}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </>
  )
}
