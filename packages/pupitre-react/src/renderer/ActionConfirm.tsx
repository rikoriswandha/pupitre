import type { ActionDescriptor, ActionResult } from '@rikology/pupitre/catalog'
import { submitAction } from '../bridge/actions.js'
import type { ConfirmDialogProps, ShellRegistry, ToastMessage } from '../shell/types.js'

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
  const onConfirm: ConfirmDialogProps['onConfirm'] = async () => {
    try {
      const response = await submitAction(action.url, { ids }, action.method)
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
            : (first ?? response.message ?? 'Unable to perform action.')
        ),
      })
    } catch {
      toast({ type: 'error', title: 'Unable to perform action.' })
    }
  }
  return (
    <Confirm
      open
      heading={action.confirm?.heading ?? action.label}
      description={action.confirm?.description}
      submitLabel={action.confirm?.submitLabel}
      cancelLabel={action.confirm?.cancelLabel}
      destructive={action.confirm?.destructive}
      icon={action.confirm?.icon}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
