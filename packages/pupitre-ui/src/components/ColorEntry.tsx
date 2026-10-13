import type { EntryDisplayProps } from './EntryShell.js'
import { EntryShell } from './EntryShell.js'

export function ColorEntry({ props = {} }: { props?: EntryDisplayProps }) {
  const color = typeof props.value === 'string' ? props.value : props.color
  return (
    <EntryShell
      label={props.label}
      columnSpan={props.columnSpan}
      inlineLabel={props.inlineLabel}
      empty={!color}
    >
      {color ? (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-6 shrink-0 rounded-md ring-1 ring-inset ring-border"
            style={{ backgroundColor: color }}
          />
          <code className="font-mono text-[0.8125rem]">{color}</code>
        </span>
      ) : (
        <span className="text-subtle-foreground">{props.placeholder ?? '—'}</span>
      )}
    </EntryShell>
  )
}
