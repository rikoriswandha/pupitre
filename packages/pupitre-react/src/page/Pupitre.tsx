import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { usePage as useInertiaPage } from '@inertiajs/react'
import type { ActionDescriptor, ActionResult, PupitrePageProps } from '@rikology/pupitre/catalog'
import {
  findUploadDescriptor,
  handleActionResult as applyActionResult,
  submitAction,
  takePendingActionToasts,
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
const emptyToasts: ToastMessage[] = []
let toastState: ToastMessage[] = []
const toastListeners = new Set<() => void>()

function subscribeToasts(listener: () => void) {
  toastListeners.add(listener)
  return () => toastListeners.delete(listener)
}

function getToasts() {
  return typeof window === 'undefined' ? emptyToasts : toastState
}

function updateToasts(update: (current: ToastMessage[]) => ToastMessage[]) {
  toastState = update(toastState)
  for (const listener of toastListeners) listener()
}
function major(version: string): string {
  return version.split('.')[0] ?? ''
}
export function isSafeNewTabUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || !/^[a-z][a-z\d+.-]*:/i.test(url)
}
const catalogReloaded: Record<string, true> = {}
export function ensureCatalogVersion(
  version: string,
  reloadRequired?: (title: string) => void
): void {
  if (major(version) !== major(catalogVersion)) {
    const key = `pupitre:catalog-reloaded:${version}`
    const session = typeof window === 'undefined' ? undefined : window.sessionStorage
    if (session?.getItem(key) || catalogReloaded[version]) {
      reloadRequired?.('Reload required')
      return
    }
    catalogReloaded[version] = true
    session?.setItem(key, '1')
    if (typeof window !== 'undefined') window.location.reload()
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
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, () => emptyToasts)
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
    updateToasts((current) => [...current, { ...toast, id: String(++toastId) }])
  }, [])
  const dismiss = useCallback(
    (id: string) => updateToasts((current) => current.filter((toast) => toast.id !== id)),
    []
  )
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
        onNavigationComplete: () => {
          for (const toast of takePendingActionToasts()) pushToast(toast)
        },
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
    ensureCatalogVersion(page.catalogVersion, (title) => pushToast({ type: 'error', title }))
  }, [page.catalogVersion, pushToast])
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
        if (action.openInNewTab && typeof window !== 'undefined' && isSafeNewTabUrl(action.url))
          window.open(action.url, '_blank', 'noopener,noreferrer')
        else getRouter().visit(action.url)
      } else if (action.kind === 'confirm') setConfirm({ action, ids: options.ids })
      else if (action.kind === 'form') setFormAction({ action, ids: options.ids })
      else {
        try {
          const response = await submitAction(action.url, { ids: options.ids }, action.method)
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
  const AuthShell = registry.shell.AuthShell
  const Toaster = registry.shell.Toaster
  const NotFound = registry.shell.NotFound
  // Host-owned component pages are rendered by their Inertia component; a
  // custom page sent to this generic renderer still uses its declared spec.
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
  const main =
    page.kind === 'auth' ? (
      <AuthShell panel={panel.panel} title={page.title}>
        {content}
      </AuthShell>
    ) : (
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
        tenant={panel.tenant}
        tenants={panel.tenants ?? []}
        notifications={panel.notifications}
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
