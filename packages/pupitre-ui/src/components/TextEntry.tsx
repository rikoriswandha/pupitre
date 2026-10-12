import { useState } from 'react'
import { Badge, Button, cn, toneText, toTone } from '../primitives/index.js'
import { Icon } from '../icons.js'
import {
  EntryCopyButton,
  EntryShell,
  entryColorStyle,
  entryIsEmpty,
  type EntryDisplayProps,
} from './EntryShell.js'

function displayValue(value: unknown, placeholder?: string): string {
  if (entryIsEmpty(value)) return placeholder ?? '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return JSON.stringify(value)
}

const proseClasses =
  'max-w-[75ch] space-y-3 leading-6 [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_a]:text-primary-ink [&_a]:underline-offset-4 [&_a:hover]:underline [&_a:focus-visible]:outline-ring [&_blockquote]:rounded-lg [&_blockquote]:bg-muted/60 [&_blockquote]:p-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_hr]:border-border [&_img]:rounded-lg'

export function TextEntry({ props = {} }: { props?: EntryDisplayProps }) {
  const [expanded, setExpanded] = useState(false)
  const empty = entryIsEmpty(props.value)
  const values = Array.isArray(props.value) ? props.value : [props.value]
  const value = Array.isArray(props.value)
    ? props.value.map((item) => displayValue(item)).join(', ')
    : displayValue(props.value, props.placeholder)
  const formatted = props.html && typeof props.value === 'string' && !empty
  const list = Array.isArray(props.value) && (props.bulleted || props.listWithLineBreaks)
  const content = formatted ? (
    <div className={proseClasses} dangerouslySetInnerHTML={{ __html: String(props.value) }} />
  ) : props.badge && !empty ? (
    <span className="flex flex-wrap gap-1.5">
      {values.map((item, index) => (
        <Badge key={index} color={toTone(props.color)} style={entryColorStyle(props.color)}>
          {displayValue(item)}
        </Badge>
      ))}
    </span>
  ) : list ? (
    <ul className={cn('space-y-1', props.bulleted && 'list-disc pl-5')}>
      {values.map((item, index) => (
        <li key={index}>{displayValue(item)}</li>
      ))}
    </ul>
  ) : (
    <span className="whitespace-pre-wrap">{value}</span>
  )
  return (
    <EntryShell label={props.label} columnSpan={props.columnSpan} inlineLabel={props.inlineLabel}>
      <div className="flex items-start gap-1.5">
        <div
          className={cn(
            'min-w-0 flex-1',
            empty
              ? 'text-subtle-foreground'
              : props.color && !props.badge && toneText[toTone(props.color)],
            (props.money ||
              props.date ||
              props.dateTime ||
              props.numeric ||
              typeof props.value === 'number') &&
              'tabular-nums'
          )}
          style={!empty && !props.badge ? entryColorStyle(props.color) : undefined}
        >
          <div
            style={
              props.lineClamp && !expanded
                ? {
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: props.lineClamp,
                    overflow: 'hidden',
                  }
                : undefined
            }
          >
            {props.icon && !empty && (
              <Icon name={props.icon} className="mr-1.5 inline size-4 align-text-bottom" />
            )}
            {props.url ? (
              <a
                href={props.url}
                className="rounded-sm text-primary-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {content}
              </a>
            ) : (
              content
            )}
          </div>
          {props.lineClamp && !empty && (
            <Button
              type="button"
              variant="link"
              color="primary"
              className="mt-1 text-[0.8125rem]"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Show less' : 'Show more'}
            </Button>
          )}
        </div>
        {props.copyable && <EntryCopyButton value={value} label={props.label} />}
      </div>
    </EntryShell>
  )
}
