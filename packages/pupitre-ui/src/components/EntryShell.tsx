import type { ReactNode } from 'react'

export type EntryProps = {
  label?: string | null
  value?: unknown
  copyable?: boolean
  url?: string
  color?: string
  icon?: string
  placeholder?: string
  columnSpan?: number | 'full'
  html?: boolean
}

export function EntryShell({
  label,
  children,
  columnSpan,
}: {
  label?: string | null
  children: ReactNode
  columnSpan?: number | 'full'
}) {
  const style =
    columnSpan === 'full'
      ? { gridColumn: '1 / -1' }
      : typeof columnSpan === 'number'
        ? { gridColumn: `span ${columnSpan} / span ${columnSpan}` }
        : undefined
  return (
    <div className="min-w-0 space-y-1" style={style}>
      {label && <dt className="text-sm font-medium text-muted-foreground">{label}</dt>}
      <div className="min-w-0 text-sm text-foreground">{children}</div>
    </div>
  )
}
