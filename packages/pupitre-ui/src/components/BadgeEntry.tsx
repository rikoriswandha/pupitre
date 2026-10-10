import type { EntryProps } from './EntryShell.js'
import { Badge } from '../primitives/index.js'
import { EntryShell } from './EntryShell.js'

const badgeColors: Record<string, string> = {
  primary: 'bg-primary text-primary-foreground',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  gray: 'bg-muted text-muted-foreground',
}

export function BadgeEntry({ props = {} }: { props?: EntryProps }) {
  const text =
    props.value === null || props.value === undefined || props.value === ''
      ? (props.placeholder ?? '—')
      : String(props.value)
  return (
    <EntryShell label={props.label} columnSpan={props.columnSpan}>
      <Badge className={badgeColors[props.color ?? 'gray'] ?? 'bg-muted text-foreground'}>
        {text}
      </Badge>
    </EntryShell>
  )
}
