import { defineWidget } from '@rikology/pupitre'
import { REVENUE_STATUSES, loadStoreOrders } from './store_orders.js'

export default defineWidget('store-revenue')
  .heading('Daily revenue')
  .description('Paid, shipped and delivered orders.')
  .span(2)
  .sort(2)
  .chart('line', async ({ ctx, filters }) => {
    const { orders, anchor } = await loadStoreOrders(ctx, filters)
    if (!anchor) return { labels: [], datasets: [] }
    const days = Array.from({ length: 14 }, (_, index) => anchor.minus({ days: 13 - index }))
    return {
      labels: days.map((day) => day.toFormat('dd LLL')),
      datasets: [
        {
          // Thousands keep axis ticks short; the label carries the unit.
          label: 'Revenue (thousand IDR)',
          data: days.map(
            (day) =>
              orders
                .filter((order) => REVENUE_STATUSES.includes(order.status))
                .filter((order) => order.placedAt!.startOf('day').equals(day))
                .reduce((sum, order) => sum + order.total, 0) / 1000
          ),
        },
      ],
    }
  })
