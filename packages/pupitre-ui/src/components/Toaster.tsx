import type { ToasterProps, ToastMessage } from '@rikology/pupitre-react'
import { t, useVisit } from '@rikology/pupitre-react'
import { useEffect, useState } from 'react'
import { Icon } from '../icons.js'
import { Button, cn } from '../primitives/index.js'

const tone: Record<ToastMessage['type'], string> = {
  success: 'text-success-ink',
  error: 'text-danger-ink',
  warning: 'text-warning-ink',
  info: 'text-info-ink',
}
const icons: Record<ToastMessage['type'], string> = {
  success: 'circle-check',
  error: 'circle-x',
  warning: 'triangle-alert',
  info: 'info',
}
type RenderedToast = { toast: ToastMessage; leaving: boolean }

/**
 * Keeps dismissed toasts mounted (inert, aria-hidden) until their exit transition
 * ends, so the stack closes the gap instead of jumping.
 */
function useLeavingToasts(toasts: ToastMessage[]) {
  const [previous, setPrevious] = useState(toasts)
  const [rendered, setRendered] = useState<RenderedToast[]>(() =>
    toasts.map((toast) => ({ toast, leaving: false }))
  )
  if (previous !== toasts) {
    setPrevious(toasts)
    const live = new Map(toasts.map((toast) => [toast.id, toast]))
    const known = new Set(rendered.map((entry) => entry.toast.id))
    setRendered([
      ...rendered.map((entry) => {
        const current = live.get(entry.toast.id)
        return current ? { toast: current, leaving: false } : { ...entry, leaving: true }
      }),
      ...toasts.filter((toast) => !known.has(toast.id)).map((toast) => ({ toast, leaving: false })),
    ])
  }
  const settle = (id: string) =>
    setRendered((current) => current.filter((entry) => !(entry.leaving && entry.toast.id === id)))
  // Fallback for when no transition runs (e.g. transitions disabled by a host stylesheet).
  const hasLeaving = rendered.some((entry) => entry.leaving)
  useEffect(() => {
    if (!hasLeaving) return
    const timer = window.setTimeout(
      () => setRendered((current) => current.filter((entry) => !entry.leaving)),
      400
    )
    return () => window.clearTimeout(timer)
  }, [hasLeaving, rendered])
  return [rendered, settle] as const
}

export function Toaster({ toasts, dismiss }: ToasterProps) {
  const visit = useVisit()
  const [rendered, settle] = useLeavingToasts(toasts)
  return (
    <div
      data-pupitre-popup=""
      aria-live="polite"
      aria-relevant="additions removals"
      className="pointer-events-none fixed right-4 bottom-4 z-[130] flex w-[min(24rem,calc(100vw-2rem))] flex-col"
    >
      {rendered.map(({ toast, leaving }) => (
        // Each toast sits in a 0fr→1fr grid row, so entering grows its slot up from the
        // bottom edge and leaving closes the slot along the same path.
        <div
          key={toast.id}
          aria-hidden={leaving || undefined}
          inert={leaving}
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-200 ease-ui starting:grid-rows-[0fr] starting:opacity-0',
            leaving ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]'
          )}
          onTransitionEnd={(event) => {
            if (leaving && event.target === event.currentTarget && event.propertyName === 'opacity')
              settle(toast.id)
          }}
        >
          <div className="min-h-0">
            <section
              role={toast.type === 'error' ? 'alert' : 'status'}
              className="pointer-events-none mt-3 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-popover"
            >
              <div className="flex items-start gap-3">
                <Icon
                  name={icons[toast.type ?? 'info']}
                  className={`mt-0.5 size-5 shrink-0 ${tone[toast.type ?? 'info']}`}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-medium leading-5">{toast.title}</h2>
                  {toast.body && (
                    <p className="mt-1 text-[0.8125rem] leading-5 text-muted-foreground">
                      {toast.body}
                    </p>
                  )}
                  {toast.actions?.length ? (
                    <div className="pointer-events-auto mt-2 flex gap-2">
                      {toast.actions.map((action, index) => (
                        <Button
                          key={`${action.label}:${index}`}
                          type="button"
                          variant="link"
                          color="primary"
                          size="xs"
                          className="min-h-6 text-xs"
                          onClick={() => {
                            if (action.url)
                              visit(action.url, {
                                method: action.method ?? 'get',
                                preserveScroll: true,
                              })
                            dismiss(toast.id)
                          }}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  aria-label={t('Dismiss notification: {title}', { title: toast.title })}
                  variant="ghost"
                  square
                  size="xs"
                  className="pointer-events-auto -mr-1 -mt-1"
                  onClick={() => dismiss(toast.id)}
                >
                  <Icon name="x" className="size-4" />
                </Button>
              </div>
            </section>
          </div>
        </div>
      ))}
    </div>
  )
}
