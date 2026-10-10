import type { ReactNode } from 'react'
import type { ActionDescriptor } from '@rikology/pupitre/catalog'
import { useRunAction } from '@rikology/pupitre-react'

export type ActionBarProps = {
  props: { actions: ActionDescriptor[]; label?: string | null; disabled?: boolean }
  children?: ReactNode
  emit: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function ActionBar({ props, children, emit, loading = false }: ActionBarProps) {
  const runAction = useRunAction()
  const groups = new Map<string, ActionDescriptor[]>()
  const ungrouped: ActionDescriptor[] = []
  for (const action of props.actions) {
    if (!action.enabled) continue
    if (!action.group) ungrouped.push(action)
    else groups.set(action.group, [...(groups.get(action.group) ?? []), action])
  }
  const button = (action: ActionDescriptor) => (
    <button
      key={action.name}
      type="button"
      disabled={loading || props.disabled}
      className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
      onClick={async () => {
        await runAction(action)
        emit('action', { action: action.name })
      }}
      data-action={action.name}
    >
      {action.label}
    </button>
  )

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-busy={loading}
      aria-label={props.label ?? undefined}
    >
      {ungrouped.map(button)}
      {[...groups].map(([group, actions]) => (
        <details className="relative" key={group}>
          <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
            {group}
          </summary>
          <div className="absolute right-0 z-20 mt-1 flex min-w-max flex-col gap-1 rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
            {actions.map(button)}
          </div>
        </details>
      ))}
      {children}
    </div>
  )
}

export default ActionBar
