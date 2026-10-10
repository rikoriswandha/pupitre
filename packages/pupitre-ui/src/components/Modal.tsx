import type { ModalProps } from '@rikology/pupitre-react'
import { Dialog } from '@base-ui/react/dialog'
import { Icon } from '../icons.js'
import { Button } from '../primitives/index.js'

const widthClasses = {
  'sm': 'max-w-sm',
  'md': 'max-w-md',
  'lg': 'max-w-lg',
  'xl': 'max-w-xl',
  '2xl': 'max-w-2xl',
  'full': 'max-w-[calc(100vw-2rem)]',
} as const

export function Modal({
  open,
  onClose,
  heading,
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
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45 transition-opacity data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Popup
          className={`fixed z-50 flex max-h-[calc(100dvh-2rem)] flex-col border border-border bg-background shadow-xl outline-none ${slideOver ? 'inset-y-0 right-0 h-dvh w-full max-w-xl rounded-l-xl' : `left-1/2 top-1/2 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl ${widthClasses[width]}`}`}
        >
          <header className="flex items-start gap-3 border-b border-border p-5">
            {icon && (
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                <Icon name={icon} className="size-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-semibold">{heading}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close render={<Button variant="ghost" aria-label="Close dialog" />}>
              <Icon name="x" className="size-4" />
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
          {footer && <footer className="border-t border-border p-4">{footer}</footer>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
