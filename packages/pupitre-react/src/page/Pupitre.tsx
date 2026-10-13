import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePage as useInertiaPage } from '@inertiajs/react'
import type { ActionDescriptor, ActionResult, PupitrePageProps } from '@rikology/pupitre/catalog'
import {
  actionDescriptor as actionDescriptorSchema,
  tableData as tableDataSchema,
} from '@rikology/pupitre/catalog'
import {
  findUploadDescriptor,
  handleActionResult as applyActionResult,
  downloadExportFile,
  waitForExport,
  submitAction,
  takePendingActionToasts,
  uploadFiles,
} from '../bridge/actions.js'
import { catalogVersion } from '@rikology/pupitre/catalog'
import { configureI18n, t } from '../i18n.js'
import type { PupitreRegistry } from '../registry/defineRegistry.js'
import type { ToastMessage } from '../shell/types.js'
import type { WidgetGridProps } from '../shell/types.js'
import type { ImportResultResponse } from '@rikology/pupitre/catalog'
import { ActionConfirm } from '../renderer/ActionConfirm.js'
import { PupitreRenderer } from '../renderer/PupitreRenderer.js'
import { ActionModal } from '../renderer/ActionModal.js'
import { getRouter } from '../bridge/inertia.js'
import { PageActionsContext } from '../runtime.js'
import { matchesKeyBinding } from '../key_bindings.js'
import { RealtimeProvider } from '../hooks/use_realtime.js'
import type { RealtimeClient } from '@rikology/pupitre/catalog'

type InertiaPupitreProps = PupitrePageProps & { errors?: Record<string, string> }
export type PupitreProps = {
  registry: PupitreRegistry
  realtime?: RealtimeClient
  /** Auto-dismiss delay in milliseconds. Defaults to 0 (manual dismissal). */
  toastDuration?: number
}
let toastId = 0
const emptyToasts: ToastMessage[] = []
let toastState: ToastMessage[] = []
const toastListeners = new Set<() => void>()
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()

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

function dismissToast(id: string) {
  const timer = toastTimers.get(id)
  if (timer !== undefined) {
    clearTimeout(timer)
    toastTimers.delete(id)
  }
  updateToasts((current) => current.filter((toast) => toast.id !== id))
}
function major(version: string): string {
  return version.split('.')[0] ?? ''
}
export function isSafeNewTabUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || !/^[a-z][a-z\d+.-]*:/i.test(url)
}
function syncDeepLink(action?: ActionDescriptor, ids?: Array<string | number>): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (action?.deepLink) {
    url.searchParams.set('action', action.name)
    const record = ids?.[0] ?? new URL(action.url, url.href).searchParams.get('record')
    if (record !== undefined && record !== null) url.searchParams.set('record', String(record))
    else url.searchParams.delete('record')
  } else {
    url.searchParams.delete('action')
    url.searchParams.delete('record')
  }
  window.history.replaceState(window.history.state, '', url)
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
      reloadRequired?.(t('Reload required'))
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
export function Pupitre({ registry, realtime, toastDuration }: PupitreProps) {
  const props = useInertiaPropsSafely()
  if (!props) return null
  return (
    <PupitreContent
      registry={registry}
      realtime={realtime}
      toastDuration={toastDuration}
      props={props}
    />
  )
}
export function PupitreContent({
  registry,
  realtime,
  toastDuration = 0,
  props,
}: PupitreProps & { props: InertiaPupitreProps }) {
  configureI18n(props.pupitre.locale, props.pupitre.messages)
  useEffect(() => {
    document.documentElement.lang = props.pupitre.locale
  }, [props.pupitre.locale])
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, () => emptyToasts)
  const initialDeepLinkHandled = useRef(false)
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
  const [importAction, setImportAction] = useState<ActionDescriptor | null>(null)
  const exportPoll = useRef<AbortController | null>(null)
  const currentPageKey = useRef(props.page.key)
  useEffect(() => {
    if (currentPageKey.current !== props.page.key) exportPoll.current?.abort()
    currentPageKey.current = props.page.key
    return () => exportPoll.current?.abort()
  }, [props.page.key])
  useEffect(() => () => exportPoll.current?.abort(), [])
  const toastDurationRef = useRef(toastDuration)
  useEffect(() => {
    toastDurationRef.current = toastDuration
  }, [toastDuration])
  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = String(++toastId)
    const duration = toastDurationRef.current
    updateToasts((current) => [...current, { ...toast, id }])
    if (duration > 0 && Number.isFinite(duration)) {
      // Timers share the store's lifetime, so navigation does not restart them.
      toastTimers.set(
        id,
        setTimeout(() => dismissToast(id), duration)
      )
    }
  }, [])
  const dismiss = dismissToast
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
      if (
        action.kind === 'direct' &&
        new URL(action.url, 'http://pupitre.local').pathname.endsWith('/import')
      ) {
        if (!registry.shell.ImportModal) {
          pushToast({ type: 'error', title: t('Import modal is unavailable in this registry') })
          return
        }
        setImportAction(action)
        return
      }
      if (action.kind === 'link') {
        if (action.openInNewTab && typeof window !== 'undefined' && isSafeNewTabUrl(action.url))
          window.open(action.url, '_blank', 'noopener,noreferrer')
        else getRouter().visit(action.url)
      } else if (action.kind === 'confirm') {
        syncDeepLink(action, options.ids)
        setConfirm({ action, ids: options.ids })
      } else if (action.kind === 'form') {
        syncDeepLink(action, options.ids)
        setFormAction({ action, ids: options.ids })
      } else {
        let pollingController: AbortController | undefined
        try {
          const response = await submitAction(action.url, { ids: options.ids }, action.method)
          if (response.exportJob) {
            pushToast({ type: 'info', title: t('Export queued') })
            let lastProgressToast = 0
            exportPoll.current?.abort()
            const controller = new AbortController()
            pollingController = controller
            exportPoll.current = controller
            const progress = await waitForExport(
              response.exportJob,
              (state) => {
                if (state.status !== 'processing' || Date.now() - lastProgressToast < 3000) return
                lastProgressToast = Date.now()
                pushToast({
                  type: 'info',
                  title: t('Export in progress'),
                  body: `${state.processedRows} / ${state.totalRows}`,
                })
              },
              { signal: controller.signal }
            )
            if (exportPoll.current === controller) exportPoll.current = null
            const downloadUrl = progress.downloadUrl ?? response.exportJob.downloadUrl
            await downloadExportFile(downloadUrl)
            pushToast({ type: 'success', title: t('Export downloaded') })
          } else if (response.downloaded)
            pushToast({ type: 'success', title: t('Export downloaded') })
          else if (response.result) handleActionResult(response.result)
          else {
            const first = response.errors ? Object.values(response.errors)[0] : undefined
            pushToast({
              type: 'error',
              title: String(
                Array.isArray(first)
                  ? first[0]
                  : (first ?? response.message ?? t('Unable to perform action.'))
              ),
            })
          }
        } catch (cause) {
          if (!pollingController?.signal.aborted)
            pushToast({
              type: 'error',
              title: cause instanceof Error ? cause.message : t('Unable to perform action.'),
            })
        } finally {
          if (exportPoll.current === pollingController) exportPoll.current = null
        }
      }
    },
    [handleActionResult, pushToast, registry]
  )
  const completeImport = useCallback(
    (result: ImportResultResponse) => {
      handleActionResult({
        flash: [
          {
            type: result.failed > 0 ? 'warning' : 'success',
            title: t('Import finished'),
            body: t('{created} created, {updated} updated, {failed} failed.', {
              created: result.created,
              updated: result.updated,
              failed: result.failed,
            }),
          },
        ],
        reload: true,
      })
    },
    [handleActionResult]
  )
  useEffect(() => {
    if (initialDeepLinkHandled.current || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const name = params.get('action')
    if (!name) {
      initialDeepLinkHandled.current = true
      return
    }
    const record = params.get('record')
    const parsedData = tableDataSchema.safeParse(props.data)
    if (record && page.kind === 'list' && !parsedData.success) return
    initialDeepLinkHandled.current = true
    const rows = parsedData.success ? parsedData.data.rows : []
    const row = record ? rows.find((item) => String(item.key) === record) : undefined
    const candidates =
      record && page.kind === 'list' ? (row?.actions ?? []) : (page.actions?.header ?? [])
    const selected = candidates.find((item) => item.name === name && item.deepLink && item.enabled)
    if (selected) window.setTimeout(() => void runAction(selected), 0)
  }, [page.actions, page.kind, props.data, runAction])
  useEffect(() => {
    const actions: ActionDescriptor[] = [...(page.actions?.header ?? [])]
    for (const element of Object.values(page.spec?.elements ?? {})) {
      if (!element || typeof element !== 'object' || !('props' in element)) continue
      const elementProps = element.props
      if (!elementProps || typeof elementProps !== 'object') continue
      for (const key of ['actions', 'footerActions']) {
        if (!(key in elementProps) || !Array.isArray(elementProps[key])) continue
        const parsed = actionDescriptorSchema.array().safeParse(elementProps[key])
        if (parsed.success) actions.push(...parsed.data)
      }
      for (const key of ['prefixAction', 'suffixAction', 'hintAction']) {
        if (!(key in elementProps)) continue
        const parsed = actionDescriptorSchema.safeParse(elementProps[key])
        if (parsed.success) actions.push(parsed.data)
      }
    }
    const byIdentity: Record<string, ActionDescriptor> = {}
    for (const action of actions) byIdentity[`${action.name}:${action.url}`] = action
    const unique = Object.values(byIdentity)
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return
      const action = unique.find(
        (item) =>
          item.enabled && item.keyBindings?.some((binding) => matchesKeyBinding(event, binding))
      )
      if (!action) return
      event.preventDefault()
      void runAction(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [page.actions, page.spec, runAction])
  const closeAction = useCallback(() => {
    if (formAction?.action.deepLink) syncDeepLink()
    setFormAction(null)
  }, [formAction])
  const pageActions = useMemo(() => ({ runAction, toast: pushToast }), [runAction, pushToast])
  const ShellComponent = registry.shell.Shell
  const AuthShell = registry.shell.AuthShell
  const Toaster = registry.shell.Toaster
  const NotFound = registry.shell.NotFound
  const WidgetGrid = registry.shell.WidgetGrid
  // Host-owned component pages are rendered by their Inertia component; a
  // custom page sent to this generic renderer still uses its declared spec.
  const relationTableData = useMemo(
    () =>
      Object.fromEntries(
        (page.relations ?? []).map((relation) => [relation.dataProp, props[relation.dataProp]])
      ),
    [page.relations, props]
  )
  const [widgetData, setWidgetData] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      (page.widgets ?? []).map((widget) => [widget.dataProp, props[widget.dataProp]])
    )
  )
  const widgets = page.widgets ?? []
  if (
    Object.keys(widgetData).length !== widgets.length ||
    widgets.some(
      (widget) =>
        !Object.hasOwn(widgetData, widget.dataProp) ||
        !Object.is(widgetData[widget.dataProp], props[widget.dataProp])
    )
  ) {
    setWidgetData(
      Object.fromEntries(widgets.map((widget) => [widget.dataProp, props[widget.dataProp]]))
    )
  }
  if (major(page.catalogVersion) !== major(catalogVersion))
    return <Toaster toasts={toasts} dismiss={dismiss} />
  const content = page.spec ? (
    <PupitreRenderer
      tableDataProps={relationTableData}
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
  const headerWidgets = page.widgets?.filter((widget) => widget.placement === 'header') ?? []
  const footerWidgets = page.widgets?.filter((widget) => widget.placement !== 'header') ?? []
  const headerWidgetContent =
    headerWidgets.length && WidgetGrid ? (
      <WidgetGrid
        widgets={headerWidgets}
        data={widgetData}
        deferred={page.deferred}
        filters={page.filters}
        customWidgets={registry.shell as unknown as WidgetGridProps['customWidgets']}
      />
    ) : null
  const footerWidgetContent =
    footerWidgets.length && WidgetGrid ? (
      <WidgetGrid
        widgets={footerWidgets}
        data={widgetData}
        deferred={page.deferred}
        filters={page.filters}
        customWidgets={registry.shell as unknown as WidgetGridProps['customWidgets']}
      />
    ) : null
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
        subNavigation={page.subNavigation ?? []}
        currentUrl={
          typeof window === 'undefined' ? '' : window.location.pathname + window.location.search
        }
        tenant={panel.tenant}
        tenants={panel.tenants ?? []}
        notifications={panel.notifications}
        locale={panel.locale}
        locales={panel.locales}
      >
        {headerWidgetContent}
        {content}
        {footerWidgetContent}
      </ShellComponent>
    )
  const modal = confirm ? (
    <ActionConfirm
      action={confirm.action}
      ids={confirm.ids}
      registry={registry.shell}
      onResult={handleActionResult}
      onCancel={() => {
        if (confirm.action.deepLink) syncDeepLink()
        setConfirm(null)
      }}
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
  const ImportModal = registry.shell.ImportModal
  const importModal =
    importAction && ImportModal ? (
      <ImportModal
        open
        action={importAction}
        onClose={() => setImportAction(null)}
        onComplete={completeImport}
      />
    ) : null
  return (
    <RealtimeProvider client={realtime} userChannel={panel.realtime?.userChannel}>
      <PageActionsContext.Provider value={pageActions}>
        {main}
        {modal}
        {actionModal}
        {importModal}
        <Toaster toasts={toasts} dismiss={dismiss} />
      </PageActionsContext.Provider>
    </RealtimeProvider>
  )
}
