import type { ReactNode } from 'react'
import type { EntryDisplayProps } from './EntryShell.js'
import { EntryShell } from './EntryShell.js'

export function RepeatableEntry({
  props = {},
  children,
}: {
  props?: EntryDisplayProps
  children?: ReactNode
}) {
  const values = Array.isArray(props.value) ? props.value : []
  return (
    <EntryShell label={props.label} columnSpan={props.columnSpan} inlineLabel={props.inlineLabel}>
      {values.length ? (
        <ol className="space-y-3">
          {values.map((item, index) => (
            <li key={index} className="rounded-lg border border-border p-4">
              {item && typeof item === 'object' ? (
                <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-x-5 gap-y-2.5">
                  {Object.entries(item).map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="min-w-0 break-words text-[0.8125rem] font-medium leading-6 text-muted-foreground">
                        {key}
                      </dt>
                      <dd className="min-w-0 break-words tabular-nums">{String(value ?? '')}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                String(item ?? '')
              )}
            </li>
          ))}
        </ol>
      ) : (
        (children ?? <span className="text-subtle-foreground">{props.placeholder ?? '—'}</span>)
      )}
    </EntryShell>
  )
}
