import { defineWidget } from '@rikology/pupitre'
import { REVENUE_STATUSES, loadStoreOrders } from './store_orders.js'

const METHODS = { card: 'Card', transfer: 'Bank transfer', cod: 'Cash on delivery' } as const

export default defineWidget('store-payments')
  .heading('Revenue by payment method')
  .sort(5)
  .chart('doughnut', async ({ ctx, filters }) => {
    const { orders } = await loadStoreOrders(ctx, filters)
    const paid = orders.filter((order) => REVENUE_STATUSES.includes(order.status))
    return {
      labels: Object.values(METHODS),
      datasets: [
        {
          label: 'Revenue (IDR)',
          data: Object.keys(METHODS).map((method) =>
            paid
              .filter((order) => order.paymentMethod === method)
              .reduce((sum, order) => sum + order.total, 0)
          ),
        },
      ],
    }
  })
