import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import ProductVariant from '#models/product_variant'

/** Text column holding JSON; keeps SQLite and other dialects identical. */
export const jsonColumn = {
  prepare: (value: unknown) =>
    value === null || value === undefined ? null : JSON.stringify(value),
  consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
}

export type ProductStatus = 'draft' | 'active' | 'archived'

export default class Product extends BaseModel {
  static table = 'products'

  @column({ isPrimary: true }) declare id: number
  @column() declare tenantId: number
  @column() declare name: string
  @column() declare slug: string
  @column() declare sku: string
  @column() declare status: ProductStatus
  @column() declare visibility: 'public' | 'unlisted' | 'private'
  @column() declare price: number
  @column() declare cost: number | null
  @column() declare stock: number
  @column() declare brandColor: string | null
  @column(jsonColumn) declare sizes: string[] | null
  @column(jsonColumn) declare labels: string[] | null
  @column(jsonColumn) declare attributes: Record<string, string> | null
  @column(jsonColumn) declare markets: string[] | null
  @column(jsonColumn) declare channels: string[] | null
  @column() declare shippingClass: 'standard' | 'express' | 'freight'
  @column() declare isActive: boolean
  @column.date() declare availableFrom: DateTime | null
  @column() declare restockTime: string | null
  @column.dateTime() declare launchAt: DateTime | null
  @column(jsonColumn) declare ageRange: [number, number] | null
  @column() declare rating: number
  @column() declare description: string | null
  @column() declare specs: string | null
  @column(jsonColumn) declare gallery: string[] | null
  @column() declare specSheet: string | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime | null

  @hasMany(() => ProductVariant) declare variants: HasMany<typeof ProductVariant>
}
