import type { EntryDisplayProps } from './EntryShell.js'
import { EntryShell } from './EntryShell.js'

export function KeyValueEntry({ props = {} }: { props?: EntryDisplayProps }) {
  const entries =
    props.value && typeof props.value === 'object' && !Array.isArray(props.value)
      ? Object.entries(props.value)
      : []
  return (
    <EntryShell
      label={props.label}
      columnSpan={props.columnSpan}
      inlineLabel={props.inlineLabel}
      empty={entries.length === 0}
      block
    >
      {entries.length ? (
        <dl className="divide-y divide-border/70">
          {entries.map(([key, value]) => (
            <div
              key={key}
              // Keys never break mid-word ("postc|ode"); the value column absorbs the squeeze.
              className="grid grid-cols-[minmax(min-content,1fr)_minmax(0,2fr)] gap-x-4 py-1.5"
            >
              <dt className="break-words text-[0.8125rem] font-medium text-muted-foreground">
                {key}
              </dt>
              <dd className="min-w-0 break-words">{String(value ?? '')}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <span className="text-subtle-foreground">{props.placeholder ?? '—'}</span>
      )}
    </EntryShell>
  )
}
