import type { ModalProps } from '@rikology/pupitre-react'
import { t } from '@rikology/pupitre-react'
import { Dialog } from '@base-ui/react/dialog'
import { Icon } from '../icons.js'
import {
  Button,
  backdropClasses,
  dialogPopupClasses,
  sheetPopupClasses,
} from '../primitives/index.js'

export function Modal({
  open,
  onClose,
  heading = t('Dialog'),
  description,
  width = 'md',
  slideOver,
  icon,
  children,
  footer,
}: ModalProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={backdropClasses} />
        <Dialog.Popup
          data-pupitre-popup=""
          className={slideOver ? sheetPopupClasses(width) : dialogPopupClasses(width)}
        >
          <header className="flex shrink-0 items-start gap-3 px-6 pt-5 pb-4">
            {icon && (
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-ink">
                <Icon name={icon} className="size-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold leading-6 text-foreground">
                {heading}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-[0.8125rem] leading-5 text-muted-foreground">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              render={<Button variant="ghost" square size="sm" aria-label={t('Close dialog')} />}
            >
              <Icon name="x" className="size-4" />
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
          {footer && (
            <footer className="flex shrink-0 justify-end border-t border-border bg-muted/30 px-6 py-3">
              {footer}
            </footer>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
