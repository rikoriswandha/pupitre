import { defineWidget } from '@rikology/pupitre'
import OrderEvent from '#models/order_event'

/** Eager (non-lazy) timeline: rendered with the first page response. */
export default defineWidget('store-activity')
  .heading('Recent order activity')
  .span(2)
  .sort(7)
  .lazy(false)
  .timeline(async ({ ctx }) => {
    const query = OrderEvent.query().preload('order').orderBy('created_at', 'desc').limit(8)
    if (ctx.pupitre.tenant) query.where('tenant_id', ctx.pupitre.tenant.id)
    const events = await query
    return events.map((event) => ({
      title: `${event.order.number} · ${event.event}`,
      time: event.createdAt.toISO()!,
      description: event.order.customerName,
      ...(event.actor ? { actor: event.actor } : {}),
      icon: event.fromStatus ? 'refresh-cw' : 'inbox',
      color:
        event.toStatus === 'refunded' || event.toStatus === 'cancelled' ? 'warning' : 'primary',
    }))
  })
