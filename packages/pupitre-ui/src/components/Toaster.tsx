import type { ToasterProps, ToastMessage } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'

const tone: Record<ToastMessage['type'], string> = {
  success: 'border-emerald-500/40',
  error: 'border-destructive/50',
  warning: 'border-amber-500/50',
  info: 'border-primary/40',
}

export function Toaster({ toasts, dismiss }: ToasterProps) {
  return (
    <div
      aria-live="polite"
      aria-relevant="additions removals"
      className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <section
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto rounded-lg border bg-background p-4 text-foreground shadow-lg ${tone[toast.type ?? 'info']}`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">{toast.title}</h2>
              {toast.body && <p className="mt-1 text-sm text-muted-foreground">{toast.body}</p>}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              onClick={() => dismiss(toast.id)}
            >
              <Icon name="x" className="size-4" />
            </button>
          </div>
        </section>
      ))}
    </div>
  )
}
