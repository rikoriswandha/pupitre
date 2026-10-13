import type { ReactNode } from 'react'
import { SpecRenderer } from '@rikology/pupitre-react'
import type { EntryDisplayProps } from './EntryShell.js'
import { EntryShell } from './EntryShell.js'

/** Figures and money (`12`, `IDR 45,000`, `Rp 1.500,00`) align right like a ledger column. */
function looksNumeric(value: unknown) {
  if (typeof value === 'number') return true
  if (typeof value !== 'string' || !value.trim()) return false
  return /^-?[\d.,\s\u00a0]+$/.test(
    value.replace(/^\p{L}{1,3}\.?[\s\u00a0]?|[\s\u00a0]?\p{L}{1,3}$/gu, '')
  )
}

export function RepeatableEntry({
  props = {},
  children,
}: {
  props?: EntryDisplayProps & {
    entries?: {
      name: string
      label?: string | null
      component?: string
      props?: Record<string, unknown>
    }[]
  }
  children?: ReactNode
}) {
  const values = Array.isArray(props.value) ? props.value : []
  const rows = values.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === 'object' && !Array.isArray(item)
  )
  // Plain records (no custom entry components) read best as a ruled table: line items.
  const tabular =
    rows.length > 0 &&
    rows.length === values.length &&
    !props.entries?.some((entry) => entry.component)
  const columns = tabular ? [...new Set(rows.flatMap((row) => Object.keys(row)))] : []
  return (
    <EntryShell
      label={props.label}
      columnSpan={props.columnSpan}
      inlineLabel={props.inlineLabel}
      empty={values.length === 0}
      block
    >
      {tabular ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums [&_tr>*:first-child]:pl-0 [&_tr>*:last-child]:pr-0">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {columns.map((key) => (
                  <th
                    key={key}
                    scope="col"
                    className={`px-3 pb-1.5 font-medium ${rows.every((row) => looksNumeric(row[key])) ? 'text-right' : 'text-left'}`}
                  >
                    {props.entries?.find((entry) => entry.name === key)?.label ?? key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-border/70">
                  {columns.map((key) => (
                    <td
                      key={key}
                      className={`px-3 py-1.5 ${rows.every((item) => looksNumeric(item[key])) ? 'text-right' : ''}`}
                    >
                      {String(row[key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : values.length ? (
        <ol className="space-y-3">
          {values.map((item, index) => (
            <li key={index} className="rounded-lg border border-border p-4">
              {item && typeof item === 'object' ? (
                <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-x-5 gap-y-2.5">
                  {Object.entries(item).map(([key, value]) => {
                    const entry = props.entries?.find((descriptor) => descriptor.name === key)
                    if (entry?.component)
                      return (
                        <div key={key} className="col-span-2">
                          <dt className="sr-only">{entry.label ?? key}</dt>
                          <dd>
                            <SpecRenderer
                              spec={{
                                root: key,
                                elements: {
                                  [key]: {
                                    type: entry.component,
                                    props: {
                                      ...entry.props,
                                      label: entry.label,
                                      value,
                                      record: item,
                                    },
                                  },
                                },
                              }}
                            />
                          </dd>
                        </div>
                      )
                    return (
                      <div key={key} className="contents">
                        <dt className="min-w-0 break-words text-[0.8125rem] font-medium leading-6 text-muted-foreground">
                          {entry?.label ?? key}
                        </dt>
                        <dd className="min-w-0 break-words tabular-nums">{String(value ?? '')}</dd>
                      </div>
                    )
                  })}
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
