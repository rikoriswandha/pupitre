import { Icon } from '../icons.js'
import type { WidgetData, WidgetDescriptor, WidgetStat } from '@rikology/pupitre/catalog'
import { Panel, toneText, toTone } from '../primitives/index.js'

type Props = { descriptor: WidgetDescriptor; data?: WidgetData }
function Sparkline({ values, color }: { values: number[]; color: string }) {
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
      className="h-12 w-full"
      preserveAspectRatio="none"
      style={{ color }}
    >
      <polygon points={`0,34 ${points} 100,34`} fill="currentColor" fillOpacity={0.08} />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function StatCard({ stat }: { stat: WidgetStat }) {
  const semanticColor =
    stat.color && ['primary', 'success', 'warning', 'danger', 'gray', 'info'].includes(stat.color)
  const colorClass = semanticColor ? toneText[toTone(stat.color)] : undefined
  const customColor = stat.color && !semanticColor ? stat.color : undefined
  const chartColor =
    customColor ??
    (semanticColor
      ? `var(--${stat.color === 'gray' ? 'muted-foreground' : stat.color})`
      : 'var(--chart-1)')
  return (
    <Panel className="h-full overflow-hidden">
      <div className="p-5 sm:p-6">
        <p className="text-[0.8125rem] font-medium text-muted-foreground">{stat.label}</p>
        <p
          className={`mt-1.5 text-[1.875rem] font-semibold leading-tight tracking-tight tabular-nums${colorClass ? ` ${colorClass}` : ''}`}
          style={customColor ? { color: customColor } : undefined}
        >
          {stat.value}
        </p>
        {stat.description && (
          <p
            className={`mt-2 flex items-center gap-1.5 text-[0.8125rem] ${colorClass ?? 'text-muted-foreground'}`}
            style={customColor ? { color: customColor } : undefined}
          >
            {stat.descriptionIcon && (
              <Icon name={stat.descriptionIcon} className="size-4" aria-hidden="true" />
            )}
            {stat.description}
          </p>
        )}
      </div>
      {stat.chart && <Sparkline values={stat.chart} color={chartColor} />}
    </Panel>
  )
}
export function WidgetStats({ descriptor, data }: Props) {
  const stats = data?.kind === 'stats' ? data.stats : []
  return (
    <section aria-label={descriptor.heading ?? 'Statistics'} className="space-y-3">
      {descriptor.heading && (
        <h2 className="text-[0.9375rem] font-semibold">{descriptor.heading}</h2>
      )}
      {descriptor.description && (
        <p className="text-sm text-muted-foreground">{descriptor.description}</p>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-4 lg:gap-6">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>
    </section>
  )
}
