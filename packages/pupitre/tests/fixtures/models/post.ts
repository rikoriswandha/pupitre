import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Category from './category.js'

export default class Post extends BaseModel {
  static table = 'posts'

  @column({ isPrimary: true }) declare id: number
  @column() declare title: string
  @column() declare slug: string
  @column() declare status: string
  @column() declare body: string | null
  @column() declare isFeatured: boolean
  @column.dateTime() declare publishedAt: DateTime | null
  @column() declare viewsCount: number
  @column() declare authorId: number | null
  @column() declare categoryId: number | null
  @column() declare items: { sku: string; qty: number }[] | null
  @column() declare cover: string | null
  @column() declare privateCover: string | null
  @column() declare tenantId: number | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'authorId' }) declare author: BelongsTo<typeof User>
  @belongsTo(() => Category, { foreignKey: 'categoryId' }) declare category: BelongsTo<
    typeof Category
  >
}
