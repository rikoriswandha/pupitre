import { useStateValue } from '@rikology/pupitre-react'
import { Badge, Panel, PanelHeader } from '@rikology/pupitre-ui'

/**
 * Host component rendered by `schema.view('MarginPreview', props)`. Server props
 * arrive untyped as React props; live form values are read from the json-render store.
 */
export function MarginPreview(props: Record<string, unknown>) {
  const currency = typeof props.currency === 'string' ? props.currency : 'IDR'
  const locale = typeof props.locale === 'string' ? props.locale : 'en'
  const price = Number(useStateValue<number | null>('/data/price') ?? 0)
  const cost = Number(useStateValue<number | null>('/data/cost') ?? 0)
  const margin = price - cost
  const percent = price > 0 ? Math.round((margin / price) * 100) : 0
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
  const tone = percent >= 40 ? 'success' : percent >= 20 ? 'warning' : 'danger'
  return (
    <Panel role="region" aria-label="Margin preview">
      <PanelHeader
        heading="Margin preview"
        description="Host React component reading live form state."
        icon="trending-up"
        aside={<Badge color={tone}>{percent}% margin</Badge>}
      />
      <div className="px-5 pb-5 sm:px-6">
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label="Margin"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.max(0, Math.min(100, percent))}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
            style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
          />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Price</dt>
            <dd className="font-medium tabular-nums">{money.format(price)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cost</dt>
            <dd className="font-medium tabular-nums">{money.format(cost)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Margin</dt>
            <dd className="font-medium tabular-nums">{money.format(margin)}</dd>
          </div>
        </dl>
      </div>
    </Panel>
  )
}
