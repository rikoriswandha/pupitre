import type { EntryProps } from './EntryShell.js'
import { EntryShell } from './EntryShell.js'

export function CodeEntry({ props = {} }: { props?: EntryProps }) {
  const value =
    typeof props.value === 'string'
      ? props.value
      : props.value == null
        ? ''
        : JSON.stringify(props.value, null, 2)
  return (
    <EntryShell label={props.label} columnSpan={props.columnSpan}>
      {value ? (
        <pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs leading-relaxed">
          {value}
        </pre>
      ) : (
        <span className="text-muted-foreground">{props.placeholder ?? '—'}</span>
      )}
    </EntryShell>
  )
}
