import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import OrderEvent from '#models/order_event'
import { jsonColumn } from '#models/product'

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'refunded' | 'cancelled'
/** Line items snapshot the product name and price at order time, like a real receipt. */
export type OrderItem = {
  productId: number
  productName?: string
  quantity: number
  unitPrice: number
}

export default class Order extends BaseModel {
  static table = 'orders'

  @column({ isPrimary: true }) declare id: number
  @column() declare tenantId: number
  @column() declare number: string
  @column() declare customerName: string
  @column() declare customerEmail: string
  @column() declare customerPhone: string | null
  @column() declare status: OrderStatus
  @column() declare paymentMethod: 'card' | 'transfer' | 'cod'
  @column(jsonColumn) declare items: OrderItem[] | null
  @column() declare total: number
  @column(jsonColumn) declare shippingAddress: Record<string, string> | null
  @column() declare notes: string | null
  @column() declare isGift: boolean
  @column() declare giftMessage: string | null
  @column() declare source: string | null
  @column.dateTime() declare placedAt: DateTime | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime | null

  @hasMany(() => OrderEvent) declare events: HasMany<typeof OrderEvent>

  /** Sum of line totals; the resource recomputes it on every save. */
  static totalFor(items: readonly Partial<OrderItem>[] | null | undefined) {
    return (items ?? []).reduce(
      (sum, item) => sum + Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0),
      0
    )
  }
}
