import type { HttpContext } from '@adonisjs/core/http'
import type { DateTime } from 'luxon'
import Order from '#models/order'
import type { OrderStatus } from '#models/order'

export const REVENUE_STATUSES: OrderStatus[] = ['paid', 'shipped', 'delivered']

/**
 * Orders for the Store overview widgets: scoped to the current tenant (widget
 * loaders are not resource-scoped automatically) and narrowed by the page's
 * `channel` filter. `anchor` is the newest order day, so seeded demo data never
 * ages out of the charted window.
 */
export async function loadStoreOrders(
  ctx: HttpContext,
  filters: Record<string, unknown>
): Promise<{ orders: Order[]; anchor: DateTime | null }> {
  const query = Order.query().whereNotNull('placed_at').orderBy('placed_at', 'asc')
  if (ctx.pupitre.tenant) query.where('tenant_id', ctx.pupitre.tenant.id)
  if (typeof filters.channel === 'string' && filters.channel) query.where('source', filters.channel)
  const orders = await query
  return { orders, anchor: orders.at(-1)?.placedAt?.startOf('day') ?? null }
}
