import { Icon } from '../icons.js'
import type { WidgetData, WidgetDescriptor, WidgetStat } from '@rikology/pupitre/catalog'
import { t } from '@rikology/pupitre-react'
import { cn, LedgerSection, toneText, toTone } from '../primitives/index.js'

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
      aria-label={t('Trend: {values}', { values: values.join(', ') })}
      role="img"
      viewBox="0 0 100 34"
      className="h-9 w-full"
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
/**
 * Shrinks long values (money, big counts) to fit one line of the card instead of
 * breaking `Rp 105.913.958` across two lines. `100cqi` is the value's container width;
 * ~0.64em is the average advance of tabular digits, separators and currency letters.
 * Sized from the widget's longest value so every card in a row shares one size.
 */
function statValueSize(chars: number) {
  return `min(1.875rem, max(1.125rem, calc(100cqi / ${(Math.max(1, chars) * 0.64).toFixed(2)})))`
}
function StatCard({ stat, valueSize }: { stat: WidgetStat; valueSize: string }) {
  const semanticColor =
    stat.color && ['primary', 'success', 'warning', 'danger', 'gray', 'info'].includes(stat.color)
  const colorClass = semanticColor ? toneText[toTone(stat.color)] : undefined
  const customColor = stat.color && !semanticColor ? stat.color : undefined
  const chartColor =
    customColor ??
    (semanticColor
      ? `var(--${stat.color === 'gray' ? 'muted-foreground' : stat.color === 'danger' ? 'destructive' : stat.color})`
      : 'var(--chart-1)')
  return (
    // One column of the ledger strip: a hairline on its left, the figure, then the note.
    <div className="flex min-w-0 flex-col border-l border-border px-5 py-1">
      <p className="text-[0.8125rem] font-medium text-muted-foreground">{stat.label}</p>
      <div className="@container">
        <p
          className={cn('mt-1 font-semibold leading-tight tracking-tight tabular-nums', colorClass)}
          style={{
            fontSize: valueSize,
            ...(customColor ? { color: customColor } : {}),
          }}
          title={stat.title}
        >
          {stat.value}
        </p>
      </div>
      {stat.description && (
        <p
          className={`mt-1.5 flex items-center gap-1.5 text-[0.8125rem] ${colorClass ?? 'text-muted-foreground'}`}
          style={customColor ? { color: customColor } : undefined}
        >
          {stat.descriptionIcon && (
            <Icon name={stat.descriptionIcon} className="size-4" aria-hidden="true" />
          )}
          {stat.description}
        </p>
      )}
      {stat.chart && (
        <div className="mt-auto pt-3">
          <Sparkline values={stat.chart} color={chartColor} />
        </div>
      )}
    </div>
  )
}
export function WidgetStats({ descriptor, data }: Props) {
  const stats = data?.kind === 'stats' ? data.stats : []
  const valueSize = statValueSize(Math.max(0, ...stats.map((stat) => String(stat.value).length)))
  return (
    <LedgerSection
      aria-label={descriptor.heading ?? t('Statistics')}
      heading={descriptor.heading}
      description={descriptor.description}
      className={descriptor.heading || descriptor.description ? undefined : 'pt-4'}
    >
      {/* The strip overhangs by one column gutter so the outer hairlines are clipped and the
          first figure lines up with the heading. */}
      <div className="overflow-hidden">
        <div className="-mx-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-y-5">
          {stats.map((stat) => (
            <StatCard key={stat.label} stat={stat} valueSize={valueSize} />
          ))}
        </div>
      </div>
    </LedgerSection>
  )
}
