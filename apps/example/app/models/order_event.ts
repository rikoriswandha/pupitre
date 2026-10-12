import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import Order from '#models/order'

export default class OrderEvent extends BaseModel {
  static table = 'order_events'

  @column({ isPrimary: true }) declare id: number
  @column() declare orderId: number
  @column() declare tenantId: number
  @column() declare event: string
  @column() declare note: string | null
  @column() declare actor: string | null
  @column() declare fromStatus: string | null
  @column() declare toStatus: string | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime | null

  @belongsTo(() => Order) declare order: BelongsTo<typeof Order>
}
