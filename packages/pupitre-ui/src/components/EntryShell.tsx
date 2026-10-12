import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { t } from '@rikology/pupitre-react'
import { Button, cn, Tooltip } from '../primitives/index.js'
import { Icon } from '../icons.js'

export type EntryProps = {
  label?: string | null
  value?: unknown
  copyable?: boolean
  url?: string
  color?: string
  icon?: string
  placeholder?: string
  columnSpan?: number | 'full'
  html?: boolean
}

export type EntryDisplayProps = EntryProps & {
  inlineLabel?: boolean
  markdown?: boolean
  badge?: boolean
  bulleted?: boolean
  listWithLineBreaks?: boolean
  lineClamp?: number
  money?: string
  date?: string | boolean
  dateTime?: string | boolean
  numeric?: boolean
  circular?: boolean
  square?: boolean
  stacked?: boolean
  width?: number | string
  height?: number | string
}

export const InlineEntryLabelContext = createContext(false)

export function entryIsEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

export function entryColorStyle(color?: string) {
  return color &&
    ![
      'primary',
      'gray',
      'secondary',
      'success',
      'warning',
      'danger',
      'destructive',
      'info',
    ].includes(color)
    ? { color }
    : undefined
}

export function EntryCopyButton({
  value,
  label = t('value'),
}: {
  value: string
  label?: string | null
}) {
  const [copied, setCopied] = useState(false)
  const timeout = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timeout.current), [])
  return (
    <Tooltip label={copied ? t('Copied') : t('Copy')}>
      <Button
        type="button"
        size="xs"
        square
        variant="ghost"
        color={copied ? 'success' : 'gray'}
        aria-label={t('Copy {label}', { label: label ?? t('value') })}
        onClick={async () => {
          if (!navigator.clipboard) return
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            window.clearTimeout(timeout.current)
            timeout.current = window.setTimeout(() => setCopied(false), 2000)
          } catch {
            setCopied(false)
          }
        }}
      >
        <Icon name={copied ? 'check' : 'copy'} className="size-3.5" />
        <span className="sr-only" role="status">
          {copied ? t('Copied') : ''}
        </span>
      </Button>
    </Tooltip>
  )
}

export function EntryShell({
  label,
  children,
  columnSpan,
  inlineLabel,
}: {
  label?: string | null
  children: ReactNode
  columnSpan?: number | 'full'
  inlineLabel?: boolean
}) {
  const inheritedInlineLabel = useContext(InlineEntryLabelContext)
  const style =
    columnSpan === 'full'
      ? { gridColumn: '1 / -1' }
      : typeof columnSpan === 'number'
        ? { gridColumn: `span ${columnSpan} / span ${columnSpan}` }
        : undefined
  return (
    <dl
      className={cn(
        'min-w-0',
        (inlineLabel ?? inheritedInlineLabel) && label
          ? 'grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-x-4 gap-y-1'
          : 'space-y-1.5'
      )}
      style={style}
    >
      <dt
        className={
          label ? 'text-[0.8125rem] font-medium leading-5 text-muted-foreground' : 'sr-only'
        }
      >
        {label ?? t('Value')}
      </dt>
      <dd className="min-w-0 break-words text-sm leading-6 text-foreground">{children}</dd>
    </dl>
  )
}
