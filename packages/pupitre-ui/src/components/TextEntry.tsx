import type { EntryProps } from './EntryShell.js'
import { EntryShell } from './EntryShell.js'

function displayValue(value: unknown, placeholder?: string): string {
  if (value === null || value === undefined || value === '') return placeholder ?? '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return JSON.stringify(value)
}

export function TextEntry({ props = {} }: { props?: EntryProps }) {
  const value = displayValue(props.value, props.placeholder)
  const content =
    props.html && typeof props.value === 'string' ? (
      <span dangerouslySetInnerHTML={{ __html: props.value }} />
    ) : (
      <span>{value}</span>
    )
  return (
    <EntryShell label={props.label} columnSpan={props.columnSpan}>
      <div
        className="flex items-center gap-2"
        style={props.color ? { color: props.color } : undefined}
      >
        {props.url ? (
          <a
            href={props.url}
            className="underline decoration-border underline-offset-4 hover:decoration-current"
          >
            {content}
          </a>
        ) : (
          content
        )}
        {props.copyable && (
          <button
            type="button"
            aria-label={`Copy ${props.label ?? 'value'}`}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            onClick={() => {
              if (typeof navigator !== 'undefined') void navigator.clipboard?.writeText(value)
            }}
          >
            Copy
          </button>
        )}
      </div>
    </EntryShell>
  )
}
