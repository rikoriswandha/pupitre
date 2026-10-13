import { kanban } from '@rikology/pupitre-kanban'
import OrderResource from './resources/order_resource.js'

/** Resource policy and tenant scope also protect board loads and moves. */
export const ordersKanban = kanban(OrderResource, {
  statusColumn: 'status',
  statuses: [
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'cancelled', label: 'Cancelled' },
  ],
  title: 'number',
  description: 'customerName',
  cardEntries: [{ name: 'customerEmail', label: 'Email' }],
  limitPerColumn: 10,
  page: {
    slug: 'orders-board',
    label: 'Orders board',
    icon: 'columns-3',
    navigationGroup: 'Showcase',
  },
})
