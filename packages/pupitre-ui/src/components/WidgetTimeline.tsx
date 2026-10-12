import type { WidgetData, WidgetDescriptor } from '@rikology/pupitre/catalog'
import { Panel, PanelHeader, EmptyState, toneText } from '../primitives/index.js'

type Props = { descriptor: WidgetDescriptor; data?: WidgetData }
const colors: Record<string, string> = toneText
function changeValue(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  return JSON.stringify(value) ?? String(value)
}

export function WidgetTimeline({ descriptor, data }: Props) {
  const items = data?.kind === 'timeline' ? data.items : []
  return (
    <Panel role="region" aria-label={descriptor.heading ?? 'Activity'} className="overflow-hidden">
      <PanelHeader heading={descriptor.heading} description={descriptor.description} />
      {items.length === 0 ? (
        <EmptyState
          icon="activity"
          heading="No activity yet."
          description="New activity will appear here."
        />
      ) : (
        <ol className="px-5 pb-5 sm:px-6 sm:pb-6">
          {items.map((item, index) => {
            const colorClass = item.color ? colors[item.color] : undefined
            return (
              <li key={index} className="relative flex gap-3 pb-6 last:pb-0">
                {index < items.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-[0.3125rem] top-3 w-px bg-border"
                  />
                )}
                <span
                  aria-hidden="true"
                  className={`relative mt-1.5 size-3 shrink-0 rounded-full border-2 border-card bg-current ${colorClass ?? 'text-muted-foreground'}`}
                  style={item.color && !colorClass ? { color: item.color } : undefined}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="break-words text-sm font-medium">{item.title}</p>
                  {item.description && (
                    <p className="break-words text-[0.8125rem] text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {item.actor && <span>{item.actor} · </span>}
                    <time className="tabular-nums" dateTime={item.time.iso}>
                      {item.time.formatted}
                    </time>
                  </p>
                  {item.changes && item.changes.length > 0 && (
                    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-left text-sm">
                        <caption className="sr-only">Changes for {item.title}</caption>
                        <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
                          <tr>
                            <th scope="col" className="p-2">
                              Field
                            </th>
                            <th scope="col" className="p-2">
                              Previous value
                            </th>
                            <th scope="col" className="p-2">
                              New value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.changes.map((change, changeIndex) => (
                            <tr
                              key={changeIndex}
                              className="border-t border-border hover:bg-muted/40"
                            >
                              <th scope="row" className="break-words p-2 font-medium">
                                {change.field}
                              </th>
                              <td className="break-words p-2">{changeValue(change.old)}</td>
                              <td className="break-words p-2">{changeValue(change.new)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
