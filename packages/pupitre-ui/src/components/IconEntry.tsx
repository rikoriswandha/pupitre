import { Icon } from '../icons.js'
import type { EntryProps } from './EntryShell.js'
import { EntryShell } from './EntryShell.js'

export function IconEntry({ props = {} }: { props?: EntryProps }) {
  const name = typeof props.value === 'string' ? props.value : props.icon
  return (
    <EntryShell label={props.label} columnSpan={props.columnSpan}>
      <span className="inline-flex items-center gap-2">
        {name ? (
          <Icon
            name={name}
            className="size-5"
            style={props.color ? { color: props.color } : undefined}
          />
        ) : (
          <span>{props.placeholder ?? '—'}</span>
        )}
        {props.copyable && name && (
          <button
            type="button"
            aria-label={`Copy ${props.label ?? 'icon name'}`}
            onClick={() => {
              if (typeof navigator !== 'undefined') void navigator.clipboard?.writeText(name)
            }}
            className="text-xs text-muted-foreground"
          >
            Copy
          </button>
        )}
      </span>
    </EntryShell>
  )
}
