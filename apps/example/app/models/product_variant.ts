import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import Product from '#models/product'

export default class ProductVariant extends BaseModel {
  static table = 'product_variants'

  @column({ isPrimary: true }) declare id: number
  @column() declare productId: number
  @column() declare tenantId: number
  @column() declare name: string
  @column() declare sku: string
  @column() declare color: string | null
  @column() declare stock: number
  @column() declare price: number
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime | null

  @belongsTo(() => Product) declare product: BelongsTo<typeof Product>
}
