import type { EntryProps } from './EntryShell.js'
import { EntryShell } from './EntryShell.js'

export function ColorEntry({ props = {} }: { props?: EntryProps }) {
  const color = typeof props.value === 'string' ? props.value : props.color
  return (
    <EntryShell label={props.label} columnSpan={props.columnSpan}>
      {color ? (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-5 rounded border border-border"
            style={{ backgroundColor: color }}
          />
          <code>{color}</code>
        </span>
      ) : (
        <span className="text-muted-foreground">{props.placeholder ?? '—'}</span>
      )}
    </EntryShell>
  )
}
