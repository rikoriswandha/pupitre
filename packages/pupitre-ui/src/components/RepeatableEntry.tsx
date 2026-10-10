import type { ReactNode } from 'react'
import type { EntryProps } from './EntryShell.js'
import { EntryShell } from './EntryShell.js'

export function RepeatableEntry({
  props = {},
  children,
}: {
  props?: EntryProps
  children?: ReactNode
}) {
  const values = Array.isArray(props.value) ? props.value : []
  return (
    <EntryShell label={props.label} columnSpan={props.columnSpan}>
      {values.length ? (
        <ol className="space-y-3">
          {values.map((item, index) => (
            <li key={index} className="rounded-md border border-border p-3">
              {item && typeof item === 'object' ? (
                <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-2">
                  {Object.entries(item).map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="break-words">{String(value ?? '')}</dd>
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
        (children ?? <span className="text-muted-foreground">{props.placeholder ?? '—'}</span>)
      )}
    </EntryShell>
  )
}
