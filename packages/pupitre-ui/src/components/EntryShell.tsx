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
/** True inside an `Infolist`; lets shared components (Placeholder) render as entries. */
export const InfolistContext = createContext(false)

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
  empty = false,
  block = false,
}: {
  label?: string | null
  children: ReactNode
  columnSpan?: number | 'full'
  inlineLabel?: boolean
  /** No value to show; view pages dim these and can fold them away. */
  empty?: boolean
  /** Wide content (tables, code, key-value lists) keeps its label above on phones. */
  block?: boolean
}) {
  const inheritedInlineLabel = useContext(InlineEntryLabelContext)
  const inInfolist = useContext(InfolistContext)
  const style =
    columnSpan === 'full'
      ? { gridColumn: '1 / -1' }
      : typeof columnSpan === 'number'
        ? { gridColumn: `span ${columnSpan} / span ${columnSpan}` }
        : undefined
  return (
    <dl
      data-entry-empty={empty || undefined}
      className={cn(
        'min-w-0',
        (inlineLabel ?? inheritedInlineLabel) && label
          ? 'grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-x-4 gap-y-1'
          : inInfolist
            ? cn(
                'space-y-0.5',
                // Phones: label and value share the line, halving a long record's height.
                !block &&
                  'max-sm:grid max-sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] max-sm:items-baseline max-sm:gap-x-4 max-sm:space-y-0'
              )
            : 'space-y-1.5',
        // On a view page every entry is a ruled line of the sheet.
        inInfolist && 'border-b border-border py-3'
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
      <dd
        className={cn(
          'min-w-0 break-words text-sm leading-6',
          empty ? 'text-subtle-foreground' : 'text-foreground'
        )}
      >
        {children}
      </dd>
    </dl>
  )
}
