import { useStateValue } from '@rikology/pupitre-react'
import { Badge } from '@rikology/pupitre-ui'

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
    <section role="region" aria-label="Margin preview">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4">
        <div>
          <h3 className="text-[0.9375rem] font-semibold">Margin preview</h3>
          <p className="text-[0.8125rem] text-muted-foreground">
            Host React component reading live form state.
          </p>
        </div>
        <Badge color={tone}>{percent}% margin</Badge>
      </div>
      <div>
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
    </section>
  )
}
