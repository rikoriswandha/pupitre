import { defineWidget } from '@rikology/pupitre'
import { loadStoreOrders } from './store_orders.js'

/** Area chart with one colored dataset per sales channel. */
export default defineWidget('store-orders-by-week')
  .heading('Orders per week by channel')
  .span(2)
  .sort(3)
  .chart('area', async ({ ctx, filters }) => {
    const { orders, anchor } = await loadStoreOrders(ctx, filters)
    if (!anchor) return { labels: [], datasets: [] }
    const weeks = Array.from({ length: 4 }, (_, index) =>
      anchor.startOf('week').minus({ weeks: 3 - index })
    )
    // Dataset colors accept any CSS color; theme chart tokens keep dark mode coherent.
    const series = [
      { source: 'web', label: 'Web shop', color: 'var(--chart-1)' },
      { source: 'retail', label: 'Retail', color: 'var(--chart-3)' },
      { source: 'wholesale', label: 'Wholesale', color: 'var(--chart-5)' },
    ]
    return {
      labels: weeks.map((week) => `Week of ${week.toFormat('dd LLL')}`),
      datasets: series.map(({ source, label, color }) => ({
        label,
        color,
        data: weeks.map(
          (week) =>
            orders.filter(
              (order) => order.source === source && order.placedAt!.startOf('week').equals(week)
            ).length
        ),
      })),
    }
  })
