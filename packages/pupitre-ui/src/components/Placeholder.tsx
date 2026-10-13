import { useContext, type ReactNode } from 'react'
import { t } from '@rikology/pupitre-react'
import { EntryShell, InfolistContext } from './EntryShell.js'

type RuntimeProps = { props: Record<string, unknown>; children?: ReactNode }
export function Placeholder({ props, children }: RuntimeProps) {
  const inInfolist = useContext(InfolistContext)
  const value = props.content
  const content =
    value === null || value === undefined
      ? children
      : typeof value === 'boolean'
        ? String(value)
        : typeof value === 'object'
          ? ''
          : String(value)
  const output =
    content === null || content === undefined || content === ''
      ? t('No content available')
      : content
  const columnSpan =
    typeof props.columnSpan === 'number' || props.columnSpan === 'full'
      ? props.columnSpan
      : undefined
  // In a view page the placeholder sits between entries, so it takes their typography.
  if (inInfolist)
    return (
      <EntryShell
        label={typeof props.label === 'string' ? props.label : null}
        columnSpan={columnSpan}
      >
        <span className="whitespace-pre-wrap" aria-live="polite">
          {output}
        </span>
      </EntryShell>
    )
  return (
    <div className="min-w-0 space-y-1.5 text-sm text-muted-foreground" aria-live="polite">
      {typeof props.label === 'string' && (
        <p className="font-medium text-foreground">{props.label}</p>
      )}
      {output}
    </div>
  )
}
export default Placeholder
