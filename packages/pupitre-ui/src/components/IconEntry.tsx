import { t } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { toneText, toTone } from '../primitives/index.js'
import {
  EntryCopyButton,
  EntryShell,
  entryColorStyle,
  type EntryDisplayProps,
} from './EntryShell.js'

export function IconEntry({ props = {} }: { props?: EntryDisplayProps }) {
  const name = typeof props.value === 'string' ? props.value : props.icon
  return (
    <EntryShell
      label={props.label}
      columnSpan={props.columnSpan}
      inlineLabel={props.inlineLabel}
      empty={!name}
    >
      <span className="inline-flex items-center gap-1.5">
        {name ? (
          <Icon
            name={name}
            className={`size-5 ${toneText[toTone(props.color)]}`}
            style={entryColorStyle(props.color)}
          />
        ) : (
          <span className="text-subtle-foreground">{props.placeholder ?? '—'}</span>
        )}
        {props.copyable && name && (
          <EntryCopyButton value={name} label={props.label ?? t('icon name')} />
        )}
      </span>
    </EntryShell>
  )
}
