import type { ActionDescriptor, ActionResult } from '@rikology/pupitre/catalog'
import { submitAction, downloadExportFile, waitForExport } from '../bridge/actions.js'
import type { ConfirmDialogProps, ShellRegistry, ToastMessage } from '../shell/types.js'
import { t } from '../i18n.js'
import { useEffect, useRef, useState } from 'react'

export type ActionConfirmProps = {
  action: ActionDescriptor
  ids?: Array<string | number>
  registry: ShellRegistry
  onResult: (result: ActionResult) => void
  onCancel: () => void
  toast: (message: Omit<ToastMessage, 'id'>) => void
}
export function ActionConfirm({
  action,
  ids,
  registry,
  onResult,
  onCancel,
  toast,
}: ActionConfirmProps) {
  const Confirm = registry.ConfirmDialog
  const [loading, setLoading] = useState(false)
  const [format, setFormat] = useState<'csv' | 'xlsx'>(action.exportFormats?.[0] ?? 'csv')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const cancel = () => {
    controller.current?.abort()
    onCancel()
  }
  const onConfirm: ConfirmDialogProps['onConfirm'] = async () => {
    if (loading) return
    setLoading(true)
    const pending = new AbortController()
    controller.current = pending
    try {
      const response = await submitAction(
        action.url,
        {
          ids,
          ...(action.exportFormats ? { format } : {}),
        },
        action.method
      )
      if (pending.signal.aborted) return
      if (response.downloaded || response.exportJob) {
        if (response.exportJob) {
          toast({ type: 'info', title: t('Export queued') })
          const progress = await waitForExport(response.exportJob, undefined, {
            signal: pending.signal,
          })
          await downloadExportFile(
            progress.downloadUrl ?? response.exportJob.downloadUrl,
            pending.signal
          )
        }
        toast({ type: 'success', title: t('Export downloaded') })
        onCancel()
        return
      }
      if (response.result) {
        onResult(response.result)
        onCancel()
        return
      }
      const first = response.errors ? Object.values(response.errors)[0] : undefined
      toast({
        type: 'error',
        title: String(
          Array.isArray(first)
            ? first[0]
            : (first ?? response.message ?? t('Unable to perform action.'))
        ),
      })
    } catch {
      if (!pending.signal.aborted) toast({ type: 'error', title: t('Unable to perform action.') })
    } finally {
      if (!pending.signal.aborted) setLoading(false)
      if (controller.current === pending) controller.current = null
    }
  }
  return (
    <Confirm
      open
      loading={loading}
      heading={action.confirm?.heading ?? action.label}
      description={action.confirm?.description}
      submitLabel={action.confirm?.submitLabel}
      cancelLabel={action.confirm?.cancelLabel}
      destructive={action.confirm?.destructive}
      icon={action.confirm?.icon}
      exportFormats={action.exportFormats}
      exportFormat={format}
      onExportFormatChange={setFormat}
      onConfirm={onConfirm}
      onCancel={cancel}
    />
  )
}
