import type { EntryDisplayProps } from './EntryShell.js'
import { Badge, toTone } from '../primitives/index.js'
import { EntryShell, entryColorStyle, entryIsEmpty } from './EntryShell.js'

export function BadgeEntry({ props = {} }: { props?: EntryDisplayProps }) {
  const empty = entryIsEmpty(props.value)
  const text = empty ? (props.placeholder ?? '—') : String(props.value)
  return (
    <EntryShell
      label={props.label}
      columnSpan={props.columnSpan}
      inlineLabel={props.inlineLabel}
      empty={empty}
    >
      {empty ? (
        <span className="text-subtle-foreground">{text}</span>
      ) : (
        <Badge color={toTone(props.color)} icon={props.icon} style={entryColorStyle(props.color)}>
          {text}
        </Badge>
      )}
    </EntryShell>
  )
}
