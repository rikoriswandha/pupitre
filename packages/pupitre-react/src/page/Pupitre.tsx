import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePage as useInertiaPage } from '@inertiajs/react'
import type { ActionDescriptor, ActionResult, PupitrePageProps } from '@rikology/pupitre/catalog'
import {
  findUploadDescriptor,
  handleActionResult as applyActionResult,
  submitAction,
  uploadFiles,
} from '../bridge/actions.js'
import { catalogVersion } from '@rikology/pupitre/catalog'
import { t } from '../i18n.js'
import type { PupitreRegistry } from '../registry/defineRegistry.js'
import type { ToastMessage } from '../shell/types.js'
import { ActionConfirm } from '../renderer/ActionConfirm.js'
import { PupitreRenderer } from '../renderer/PupitreRenderer.js'
import { ActionModal } from '../renderer/ActionModal.js'
import { getRouter } from '../bridge/inertia.js'
import { PageActionsContext } from '../runtime.js'

type InertiaPupitreProps = PupitrePageProps & { errors?: Record<string, string> }
export type PupitreProps = { registry: PupitreRegistry }
let toastId = 0
function major(version: string): string {
  return version.split('.')[0] ?? ''
}
export function ensureCatalogVersion(version: string, toast: () => void): void {
  if (major(version) !== major(catalogVersion)) {
    queueMicrotask(toast)
    getRouter().reload()
  }
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
export function PupitreContent({
  registry,
  props,
}: {
  registry: PupitreRegistry
  props: InertiaPupitreProps
}) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [optimisticData, setOptimisticData] = useState<{
    base: PupitrePageProps['data']
    value: unknown
  } | null>(null)
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
  const handleActionResult = useCallback(
    (result: ActionResult) =>
      applyActionResult(result, {
        data: props.data,
        pageKind: page.kind,
        toast: pushToast,
        setData: (value) =>
          setOptimisticData({ base: props.data, value: value as PupitrePageProps['data'] }),
      }),
    [page.kind, props.data, pushToast]
  )
  const data =
    optimisticData && optimisticData.base === props.data
      ? (optimisticData.value as PupitrePageProps['data'])
      : props.data
  useEffect(() => {
    if (typeof document !== 'undefined') document.title = page.title
  }, [page])
  useEffect(() => {
    ensureCatalogVersion(page.catalogVersion, () =>
      pushToast({ type: 'warning', title: t('Reload required') })
    )
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
      else {
        try {
          const response = await submitAction(action.url, { ids: options.ids })
          if (response.result) handleActionResult(response.result)
          else {
            const first = response.errors ? Object.values(response.errors)[0] : undefined
            pushToast({
              type: 'error',
              title: String(
                Array.isArray(first)
                  ? first[0]
                  : (first ?? response.message ?? 'Unable to perform action.')
              ),
            })
          }
        } catch {
          pushToast({ type: 'error', title: 'Unable to perform action.' })
        }
      }
    },
    [handleActionResult, pushToast]
  )
  const closeAction = useCallback(() => setFormAction(null), [])
  const pageActions = useMemo(() => ({ runAction, toast: pushToast }), [runAction, pushToast])
  const ShellComponent = registry.shell.Shell
  const Toaster = registry.shell.Toaster
  const NotFound = registry.shell.NotFound
  if (page.kind === 'custom') return null
  if (major(page.catalogVersion) !== major(catalogVersion))
    return <Toaster toasts={toasts} dismiss={dismiss} />
  const content = page.spec ? (
    <PupitreRenderer
      page={page}
      data={data}
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
  const modal = confirm ? (
    <ActionConfirm
      action={confirm.action}
      ids={confirm.ids}
      registry={registry.shell}
      onResult={handleActionResult}
      onCancel={() => setConfirm(null)}
      toast={pushToast}
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
      onResult={handleActionResult}
    />
  ) : null
  return (
    <PageActionsContext.Provider value={pageActions}>
      {main}
      {modal}
      {actionModal}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </PageActionsContext.Provider>
  )
}
