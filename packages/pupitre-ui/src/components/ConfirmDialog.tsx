import { Dialog } from '@base-ui/react/dialog'
import { Icon } from '../icons.js'
import { Button, backdropClasses, dialogPopupClasses } from '../primitives/index.js'
import { t } from '@rikology/pupitre-react'

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
  submitLabel = t('Confirm'),
  cancelLabel = t('Cancel'),
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
        <Dialog.Backdrop className={backdropClasses} />
        <Dialog.Popup data-pupitre-popup="" className={dialogPopupClasses('sm')}>
          <div className="flex items-start gap-4 px-6 py-5">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-full ${destructive ? 'bg-danger-soft text-danger-ink' : 'bg-info-soft text-info-ink'}`}
            >
              <Icon
                name={destructive ? 'triangle-alert' : (icon ?? 'circle-help')}
                className="size-5"
              />
            </span>
            <div className="min-w-0 pt-2">
              <Dialog.Title className="text-base font-semibold leading-6 text-pretty">
                {heading}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1.5 text-sm leading-5 text-muted-foreground text-pretty">
                  {description}
                </Dialog.Description>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3">
            <Button color="gray" disabled={loading} onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              color={destructive ? 'danger' : 'primary'}
              loading={loading}
              onClick={onConfirm}
            >
              {loading ? t('Working…') : submitLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
