import { defineWidget } from '@rikology/pupitre'
import { loadStoreOrders } from './store_orders.js'

const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'refunded', 'cancelled'] as const

export default defineWidget('store-status')
  .heading('Orders by status')
  .sort(4)
  .chart('pie', async ({ ctx, filters }) => {
    const { orders } = await loadStoreOrders(ctx, filters)
    return {
      labels: STATUSES.map((status) => status[0]!.toUpperCase() + status.slice(1)),
      datasets: [
        {
          label: 'Orders',
          data: STATUSES.map((status) => orders.filter((order) => order.status === status).length),
        },
      ],
    }
  })
