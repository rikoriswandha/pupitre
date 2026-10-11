import { Icon } from '../icons.js'
import type { WidgetData, WidgetDescriptor, WidgetStat } from '@rikology/pupitre/catalog'

type Props = { descriptor: WidgetDescriptor; data?: WidgetData }
const statColors: Record<string, string> = {
  primary: 'text-primary',
  success: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-amber-800 dark:text-amber-200',
  danger: 'text-destructive',
  gray: 'text-muted-foreground',
}
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const points = values
    .map(
      (value, index) =>
        `${(index / (values.length - 1)) * 100},${30 - ((value - min) / range) * 26}`
    )
    .join(' ')
  return (
    <svg
      aria-label={`Trend: ${values.join(', ')}`}
      role="img"
      viewBox="0 0 100 34"
      className="h-9 w-24 text-primary"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function StatCard({ stat }: { stat: WidgetStat }) {
  const colorClass = stat.color ? statColors[stat.color] : undefined
  return (
    <article className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{stat.label}</p>
        {stat.descriptionIcon && (
          <Icon
            name={stat.descriptionIcon}
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>
      <p
        className={`mt-2 text-2xl font-semibold${colorClass ? ` ${colorClass}` : ''}`}
        style={stat.color && !colorClass ? { color: stat.color } : undefined}
      >
        {stat.value}
      </p>
      {stat.description && <p className="mt-1 text-sm text-muted-foreground">{stat.description}</p>}
      {stat.chart && (
        <div className="mt-3">
          <Sparkline values={stat.chart} />
        </div>
      )}
    </article>
  )
}
export function WidgetStats({ descriptor, data }: Props) {
  const stats = data?.kind === 'stats' ? data.stats : []
  return (
    <section aria-label={descriptor.heading ?? 'Statistics'} className="space-y-3">
      {descriptor.heading && <h2 className="text-base font-semibold">{descriptor.heading}</h2>}
      {descriptor.description && (
        <p className="text-sm text-muted-foreground">{descriptor.description}</p>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>
    </section>
  )
}
