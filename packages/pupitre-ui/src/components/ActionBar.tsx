import type { ReactNode } from 'react'
import type { ActionDescriptor } from '@rikology/pupitre/catalog'
import { ActionList } from './ActionList.js'

export type ActionBarProps = {
  props: { actions: ActionDescriptor[]; label?: string | null; disabled?: boolean }
  children?: ReactNode
  emit: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function ActionBar({ props, children, emit, loading = false }: ActionBarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-busy={loading}
      aria-label={props.label ?? undefined}
    >
      <ActionList
        actions={props.actions}
        disabled={loading || props.disabled}
        onRun={(action) => emit('action', { action: action.name })}
      />
      {children}
    </div>
  )
}

export default ActionBar
