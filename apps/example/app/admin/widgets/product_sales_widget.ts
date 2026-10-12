import { defineWidget } from '@rikology/pupitre'
import Order from '#models/order'
import Product from '#models/product'

/** Record-aware line chart placed under the product view page. */
export default defineWidget('product-sales')
  .heading('Units sold per week')
  .description('Paid, shipped and delivered orders containing this product.')
  .span('full')
  .chart('line', async ({ record }) => {
    if (!(record instanceof Product)) return { labels: [], datasets: [] }
    const orders = await Order.query()
      .where('tenant_id', record.tenantId)
      .whereIn('status', ['paid', 'shipped', 'delivered'])
      .whereNotNull('placed_at')
      .orderBy('placed_at', 'asc')
    const latest = orders.at(-1)?.placedAt?.startOf('week')
    if (!latest) return { labels: [], datasets: [] }
    const weeks = Array.from({ length: 6 }, (_, index) => latest.minus({ weeks: 5 - index }))
    return {
      labels: weeks.map((week) => week.toFormat('dd LLL')),
      datasets: [
        {
          label: 'Units',
          data: weeks.map((week) =>
            orders
              .filter((order) => order.placedAt!.startOf('week').equals(week))
              .flatMap((order) => order.items ?? [])
              .filter((item) => item.productId === record.id)
              .reduce((sum, item) => sum + item.quantity, 0)
          ),
        },
      ],
    }
  })
