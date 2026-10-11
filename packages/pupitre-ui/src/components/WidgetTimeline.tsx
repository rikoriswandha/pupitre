import type { WidgetData, WidgetDescriptor } from '@rikology/pupitre/catalog'
import { Icon } from '../icons.js'

type Props = { descriptor: WidgetDescriptor; data?: WidgetData }
const colors: Record<string, string> = {
  primary: 'text-primary',
  success: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-amber-800 dark:text-amber-200',
  danger: 'text-destructive',
  gray: 'text-muted-foreground',
}
function changeValue(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  return JSON.stringify(value) ?? String(value)
}

export function WidgetTimeline({ descriptor, data }: Props) {
  const items = data?.kind === 'timeline' ? data.items : []
  return (
    <section aria-label={descriptor.heading ?? 'Activity'} className="space-y-3">
      {descriptor.heading && <h2 className="text-base font-semibold">{descriptor.heading}</h2>}
      {descriptor.description && (
        <p className="text-sm text-muted-foreground">{descriptor.description}</p>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="space-y-4 rounded-lg border bg-card p-4">
          {items.map((item, index) => {
            const colorClass = item.color ? colors[item.color] : undefined
            return (
              <li key={index} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-1 shrink-0 ${colorClass ?? 'text-muted-foreground'}`}
                  style={item.color && !colorClass ? { color: item.color } : undefined}
                >
                  <Icon name={item.icon ?? 'activity'} className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="break-words font-medium">{item.title}</p>
                  {item.description && <p className="break-words text-sm">{item.description}</p>}
                  <p className="text-sm text-muted-foreground">
                    {item.actor && <span>{item.actor} · </span>}
                    <time dateTime={item.time.iso}>{item.time.formatted}</time>
                  </p>
                  {item.changes && item.changes.length > 0 && (
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-left text-sm">
                        <caption className="sr-only">Changes for {item.title}</caption>
                        <thead className="bg-muted">
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
                            <tr key={changeIndex} className="border-t">
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
    </section>
  )
}
