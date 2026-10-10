import type { EntryProps } from './EntryShell.js'
import { EntryShell } from './EntryShell.js'

export function KeyValueEntry({ props = {} }: { props?: EntryProps }) {
  const entries =
    props.value && typeof props.value === 'object' && !Array.isArray(props.value)
      ? Object.entries(props.value)
      : []
  return (
    <EntryShell label={props.label} columnSpan={props.columnSpan}>
      {entries.length ? (
        <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="truncate text-muted-foreground">{key}</dt>
              <dd className="break-words">{String(value ?? '')}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <span className="text-muted-foreground">{props.placeholder ?? '—'}</span>
      )}
    </EntryShell>
  )
}
