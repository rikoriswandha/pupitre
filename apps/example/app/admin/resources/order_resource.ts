import {
  action,
  actions,
  defineRelationManager,
  defineResource,
  pages,
  schema,
  table,
} from '@rikology/pupitre'
import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Order from '#models/order'
import type { OrderItem, OrderStatus } from '#models/order'
import OrderEvent from '#models/order_event'
import Product from '#models/product'
import type User from '#models/user'
import OrderPolicy from '#policies/order_policy'
import orderHistoryWidget from '#admin/widgets/order_history_widget'

/**
 * Showcase: Orders. A wizard form with a repeater, hidden/dehydrated fields,
 * lifecycle hooks writing an audit-style event log, guarded status actions,
 * a timeline widget and a read-only relation manager.
 */

const STATUS_OPTIONS: Record<OrderStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
}
const STATUS_COLORS = {
  pending: 'gray',
  paid: 'primary',
  shipped: 'info',
  delivered: 'success',
  refunded: 'warning',
  cancelled: 'danger',
}
const PAYMENT_OPTIONS = { card: 'Card', transfer: 'Bank transfer', cod: 'Cash on delivery' }
const PAYMENT_ICONS = { card: 'key-round', transfer: 'building', cod: 'inbox' }

/** Appends one row to the order's history; every status change goes through here. */
async function recordOrderEvent(
  order: Order,
  values: { event: string; note?: string | null; fromStatus?: string | null },
  ctx?: HttpContext,
  trx?: TransactionClientContract
) {
  const user = ctx?.auth.user as User | undefined
  await OrderEvent.create(
    {
      orderId: order.id,
      tenantId: order.tenantId,
      event: values.event,
      note: values.note ?? null,
      actor: user ? (user.fullName ?? user.email) : null,
      fromStatus: values.fromStatus ?? null,
      toStatus: order.status,
    },
    trx ? { client: trx } : undefined
  )
}

const markShipped = action('mark-shipped')
  .label('Mark shipped')
  .icon('send')
  .color('success')
  .requiresConfirmation()
  .visible(({ record }) => (record as Order).status === 'paid')
  .handle(async ({ record, ctx, notify }) => {
    const order = record as Order
    order.status = 'shipped'
    await order.save()
    await recordOrderEvent(order, { event: 'Marked shipped', fromStatus: 'paid' }, ctx)
    notify?.success(`Order ${order.number} shipped`).send()
  })
  .after(({ refresh }) => {
    refresh.table()
  })

const refund = action('refund')
  .label('Refund')
  .icon('rotate-ccw')
  .color('danger')
  .can('refund')
  .modalHeading('Refund order')
  .modalDescription('Refunds are recorded in the order history.')
  .modalIcon('rotate-ccw')
  .modalWidth('lg')
  .modalSubmitLabel('Issue refund')
  .visible(({ record }) => ['paid', 'shipped', 'delivered'].includes((record as Order).status))
  .form([
    schema.number('amount').label('Refund amount').required().min(1).prefix('Rp'),
    schema
      .select('reason')
      .label('Reason')
      .options({
        damaged: 'Arrived damaged',
        wrong: 'Wrong item',
        late: 'Arrived late',
        other: 'Other',
      })
      .required()
      .live(),
    schema
      .textarea('details')
      .label('Details')
      .rows(3)
      .visible(({ get }) => get('reason') === 'other'),
  ])
  .fillForm(({ record }) => ({ amount: (record as Order).total, reason: 'damaged' }))
  .handle(async ({ record, data, ctx, notify }) => {
    const order = record as Order
    const fromStatus = order.status
    const amount = Number(data?.amount ?? 0)
    order.status = 'refunded'
    await order.save()
    await recordOrderEvent(
      order,
      {
        event: `Refunded Rp ${amount.toLocaleString('id-ID')}`,
        note: String(data?.details || data?.reason || ''),
        fromStatus,
      },
      ctx
    )
    const notification = notify?.warning(`Order ${order.number} refunded`).body(order.customerName)
    notification?.send()
    // Also persisted to the bell tray for every operator on this account.
    await notification?.sendToDatabase()
  })

const bulkShip = action('ship-selected')
  .label('Mark selected shipped')
  .icon('send')
  .requiresConfirmation()
  .deselectAfter()
  .handle(async ({ records, ctx, notify }) => {
    const paid = ((records ?? []) as Order[]).filter((order) => order.status === 'paid')
    for (const order of paid) {
      order.status = 'shipped'
      await order.save()
      await recordOrderEvent(order, { event: 'Marked shipped', fromStatus: 'paid' }, ctx)
    }
    notify
      ?.info(`${paid.length} of ${records?.length ?? 0} orders were paid and are now shipped`)
      .send()
  })

const historyManager = defineRelationManager(Order, 'events')
  .label('History')
  .icon('clock')
  .readOnly()
  .table((t) =>
    t
      .columns([
        table.text('event').label('Event'),
        table.badge('toStatus').label('Status').options(STATUS_OPTIONS).colors(STATUS_COLORS),
        table.text('actor').label('By'),
        table.text('note').label('Note').limit(60),
        table.text('createdAt').label('When').dateTime().since().sortable(),
      ])
      .defaultSort('createdAt', 'desc')
  )

export default defineResource(Order)
  .slug('orders')
  .label('Order')
  .pluralLabel('Orders')
  .icon('inbox')
  .navigation({ group: 'Showcase', sort: 2 })
  .recordTitle('number')
  .globallySearchable(['number', 'customerName', 'customerEmail'])
  .globalSearchDetails((record) => [record.customerName, STATUS_OPTIONS[record.status]])
  .policy(OrderPolicy)
  .mutateBeforeCreate((data) => ({
    ...data,
    number: `WEB-${Date.now().toString(36).toUpperCase()}`,
  }))
  // Snapshot product names and recompute the total from validated line items. Queries
  // inside hooks must use `trx`: SQLite has one connection, held by the save transaction.
  .mutateBeforeSave(async (data, _record, ctx, trx) => {
    const items = (data.items ?? []) as OrderItem[]
    const query = Product.query({ client: trx }).whereIn(
      'id',
      items.map((item) => Number(item.productId))
    )
    if (ctx.pupitre.tenant) query.where('tenant_id', ctx.pupitre.tenant.id)
    const products = await query
    const names = new Map(products.map((product) => [product.id, product.name]))
    const snapshot = items.map((item) => ({
      productId: Number(item.productId),
      productName: names.get(Number(item.productId)) ?? 'Unknown product',
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    }))
    return { ...data, items: snapshot, total: Order.totalFor(snapshot) }
  })
  .beforeSave(async (record, data, ctx, trx) => {
    if (record && data.status && data.status !== record.status) {
      const fromStatus = record.status
      record.status = data.status as OrderStatus
      await recordOrderEvent(
        record,
        { event: `Marked ${String(data.status)}`, note: 'Changed in the order form', fromStatus },
        ctx,
        trx
      )
    }
  })
  .afterCreate(async (record, ctx, trx) => {
    await recordOrderEvent(record, { event: 'Order placed', note: 'Created by staff' }, ctx, trx)
  })
  .form((s) => [
    s
      .wizard([
        s
          .step('Customer')
          .icon('user')
          .description('Who is buying')
          .components([
            s
              .text('number')
              .label('Order number')
              .readOnly()
              .dehydrated(false)
              .helperText('Generated when the order is created.')
              .visible(({ record }) => Boolean(record)),
            s.text('customerName').label('Name').required().maxLength(120).autocomplete('name'),
            s.email('customerEmail').label('Email').required().maxLength(254).autocomplete('email'),
            s.text('customerPhone').label('Phone').tel().mask('(999) 999-9999').autocomplete('tel'),
          ]),
        s
          .step('Items')
          .icon('list')
          .description('What they ordered')
          .components([
            s
              .repeater('items')
              .label('Line items')
              .schema([
                schema
                  .select('productId')
                  .label('Product')
                  .required()
                  .searchable()
                  // Async options: searched on the server and scoped to the current tenant.
                  .options(async ({ search, ctx, values }) => {
                    const query = Product.query().orderBy('name', 'asc').limit(25)
                    if (ctx?.pupitre.tenant) query.where('tenant_id', ctx.pupitre.tenant.id)
                    if (values?.length) query.whereIn('id', values.map(Number))
                    else if (search) query.whereLike('name', `%${search}%`)
                    const products = await query
                    return products.map((product) => ({
                      value: product.id,
                      label: product.name,
                      description: `Rp ${product.price.toLocaleString('id-ID')} · ${product.stock} in stock`,
                    }))
                  }),
                schema.number('quantity').label('Qty').required().min(1).max(99).default(1),
                schema
                  .number('unitPrice')
                  .label('Unit price')
                  .required()
                  .min(0)
                  .prefix('Rp')
                  .default(0),
                schema
                  .placeholder('lineTotal')
                  .label('Line total')
                  .content(({ get }) => get('quantity') * get('unitPrice')),
              ])
              .grid({ default: 1, md: 4 })
              .itemLabel(({ get }) => `${get('quantity')} × Rp ${get('unitPrice')}`)
              .minItems(1)
              .maxItems(20)
              .defaultItems(1)
              .reorderable()
              .collapsible()
              .cloneable()
              .addLabel('Add line item'),
            s
              .placeholder('totalNote')
              .content('The order total is recalculated from line items when you save.'),
          ]),
        s
          .step('Payment & delivery')
          .icon('send')
          .description('How it is paid and shipped')
          .components([
            s
              .radio('paymentMethod')
              .label('Payment method')
              .options(PAYMENT_OPTIONS)
              .descriptions({
                card: 'Captured immediately.',
                transfer: 'Paid within 24 hours.',
                cod: 'Collected by the courier.',
              })
              .inline()
              .default('card')
              .required(),
            s.select('status').options(STATUS_OPTIONS).default('pending').required(),
            s
              .dateTime('placedAt')
              .label('Placed at')
              .required()
              .default(() => new Date().toISOString()),
            s
              .keyValue('shippingAddress')
              .label('Shipping address')
              .keyLabel('Line')
              .valueLabel('Value')
              .keyPlaceholder('street')
              .valuePlaceholder('Jalan Merdeka 1')
              .default(() => ({})),
            s.checkbox('isGift').label('This order is a gift').inline().live(),
            s
              .text('giftMessage')
              .label('Gift message')
              .maxLength(140)
              .visible(({ get }) => get('isGift') === true)
              .dehydratedWhenHidden(false),
            s.textarea('notes').label('Delivery notes').rows(2).autosize(),
            // Hidden fields still validate and persist: tag staff-created orders.
            s.hidden('source').default('admin'),
          ]),
      ])
      .skippable()
      .submitLabel('Save order'),
  ])
  .table((t) =>
    t
      .columns([
        table.text('number').label('Order').searchable().sortable(),
        table
          .text('customerName')
          .label('Customer')
          .searchable()
          .description(({ record }) => (record as Order).customerEmail),
        table.badge('status').options(STATUS_OPTIONS).colors(STATUS_COLORS).sortable(),
        table.icon('paymentMethod').label('Payment').icons(PAYMENT_ICONS),
        table.icon('isGift').label('Gift').boolean().alignment('center'),
        table.text('total').money('IDR').sortable().alignment('end').summarize(['sum', 'avg']),
        table.text('placedAt').label('Placed').dateTime().since().sortable(),
        table.text('source').label('Source').badge().toggleable({ hiddenByDefault: true }),
      ])
      .filters([
        table.filter.select('status').options(STATUS_OPTIONS).multiple(),
        table.filter.select('paymentMethod').options(PAYMENT_OPTIONS),
        table.filter.ternary('isGift').trueLabel('Gifts').falseLabel('Not gifts'),
        table.filter.dateRange('placedAt'),
      ])
      .filtersLayout('above')
      .groups([
        t.group('status').label('Status').collapsible(),
        t.group('paymentMethod').label('Payment method'),
      ])
      .defaultGroup('status')
      .defaultSort('placedAt', 'desc')
      .striped()
  )
  .infolist((s) => [
    s
      .section('Summary')
      .columns(4)
      .components([
        s.textEntry('number').label('Order').copyable(),
        s.badgeEntry('status').options(STATUS_OPTIONS).colors(STATUS_COLORS),
        s.textEntry('total').money('IDR'),
        s.textEntry('placedAt').label('Placed').dateTime('dd LLL yyyy, HH:mm'),
        s.iconEntry('paymentMethod').label('Payment').icons(PAYMENT_ICONS),
        s.iconEntry('isGift').label('Gift').boolean(),
        s.textEntry('giftMessage').label('Gift message'),
        s.textEntry('source').badge(),
      ]),
    s
      .section('Customer')
      .columns(3)
      .components([
        s.textEntry('customerName').label('Name'),
        s
          .textEntry('customerEmail')
          .label('Email')
          .url(({ get }) => `mailto:${String(get('customerEmail'))}`),
        s.textEntry('customerPhone').label('Phone'),
        s.keyValueEntry('shippingAddress').label('Shipping address'),
      ]),
    s
      .repeatableEntry('items')
      .label('Line items')
      .schema([
        s.textEntry('productName').label('Product'),
        s.textEntry('quantity').label('Qty'),
        s.textEntry('unitPrice').label('Unit price').money('IDR'),
      ]),
  ])
  .actions({
    header: [actions.create(), actions.export()],
    row: [actions.view(), actions.edit(), markShipped, refund, actions.delete()],
    bulk: [bulkShip, actions.delete()],
  })
  .pages({
    list: pages.list().tabs({
      all: { label: 'All' },
      open: {
        label: 'To fulfil',
        where: (query) => query.whereIn('status', ['pending', 'paid']),
      },
      shipped: { label: 'Shipped', where: { status: 'shipped' } },
      closed: {
        label: 'Closed',
        where: (query) => query.whereIn('status', ['delivered', 'refunded', 'cancelled']),
      },
    }),
    create: pages.create().redirectTo('view'),
    edit: pages.edit(),
    view: pages.view().footerWidgets([orderHistoryWidget]),
  })
  .relations([historyManager])
