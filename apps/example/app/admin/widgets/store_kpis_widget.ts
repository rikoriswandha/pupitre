import { defineWidget, stat } from '@rikology/pupitre'
import Product from '#models/product'
import { REVENUE_STATUSES, loadStoreOrders } from './store_orders.js'

/** Stats with sparklines, trend descriptions and colors; refreshed by polling. */
export default defineWidget('store-kpis')
  .heading('Last 7 days')
  .sort(1)
  .poll('15s')
  .stats(async ({ ctx, filters }) => {
    const { orders, anchor } = await loadStoreOrders(ctx, filters)
    const days = anchor
      ? Array.from({ length: 14 }, (_, index) => anchor.minus({ days: 13 - index }))
      : []
    const revenueByDay = days.map((day) =>
      orders
        .filter((order) => REVENUE_STATUSES.includes(order.status))
        .filter((order) => order.placedAt!.startOf('day').equals(day))
        .reduce((sum, order) => sum + order.total, 0)
    )
    const ordersByDay = days.map(
      (day) => orders.filter((order) => order.placedAt!.startOf('day').equals(day)).length
    )
    const current = revenueByDay.slice(7).reduce((sum, value) => sum + value, 0)
    const previous = revenueByDay.slice(0, 7).reduce((sum, value) => sum + value, 0)
    const change = previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100)
    const orderCount = ordersByDay.slice(7).reduce((sum, value) => sum + value, 0)

    const lowStock = Product.query().where('stock', '<', 10).whereNot('status', 'archived')
    if (ctx.pupitre.tenant) lowStock.where('tenant_id', ctx.pupitre.tenant.id)
    const [lowStockRow] = await lowStock.count('* as total')
    const lowStockCount = Number(lowStockRow?.$extras.total ?? 0)

    return [
      // Numeric values follow each user's number format; compact shortens with a full tooltip.
      stat('Revenue', current)
        .money('IDR')
        .compact()
        .description(`${change >= 0 ? '+' : ''}${change}% vs previous 7 days`)
        .descriptionIcon(change >= 0 ? 'trending-up' : 'trending-down')
        .color(change >= 0 ? 'success' : 'danger')
        .chart(revenueByDay.slice(7)),
      stat('Orders', orderCount).description('All statuses').chart(ordersByDay.slice(7)),
      stat('Average order', orderCount ? Math.round(current / orderCount) : 0)
        .money('IDR')
        .description('Revenue ÷ orders'),
      stat('Low stock', lowStockCount)
        .description(lowStockCount ? 'Products under 10 units' : 'All products stocked')
        .descriptionIcon(lowStockCount ? 'triangle-alert' : 'check')
        .color(lowStockCount ? 'warning' : 'success'),
    ]
  })
