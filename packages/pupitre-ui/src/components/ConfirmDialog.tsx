import { Dialog } from '@base-ui/react/dialog'
import { Icon } from '../icons.js'
import { Button } from '../primitives/index.js'

export type ConfirmDialogProps = {
  open: boolean
  heading: string
  description?: string
  submitLabel?: string
  cancelLabel?: string
  destructive?: boolean
  icon?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  heading,
  description,
  submitLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  icon,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/45" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-6 shadow-xl outline-none">
          <div className="flex items-start gap-3">
            {icon && (
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted">
                <Icon name={icon} className="size-4" />
              </span>
            )}
            <div>
              <Dialog.Title className="text-lg font-semibold">{heading}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                  {description}
                </Dialog.Description>
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" disabled={loading} onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? 'destructive' : 'default'}
              disabled={loading}
              onClick={onConfirm}
            >
              {loading ? 'Working…' : submitLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
