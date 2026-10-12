import { defineWidget } from '@rikology/pupitre'
import Order from '#models/order'

const STATUS_COLORS: Record<string, string> = {
  pending: 'gray',
  paid: 'primary',
  shipped: 'info',
  delivered: 'success',
  refunded: 'warning',
  cancelled: 'danger',
}

/** Record-aware timeline placed under the order view page. */
export default defineWidget('order-history')
  .heading('Order history')
  .span('full')
  .timeline(async ({ record }) => {
    if (!(record instanceof Order)) return []
    const events = await record.related('events').query().orderBy('created_at', 'desc')
    return events.map((event) => ({
      title: event.event,
      time: event.createdAt.toISO()!,
      ...(event.note ? { description: event.note } : {}),
      ...(event.actor ? { actor: event.actor } : {}),
      icon: event.fromStatus ? 'refresh-cw' : 'inbox',
      color: STATUS_COLORS[event.toStatus ?? ''] ?? 'gray',
      ...(event.fromStatus
        ? { changes: [{ field: 'status', old: event.fromStatus, new: event.toStatus }] }
        : {}),
    }))
  })
