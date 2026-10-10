import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { PostSchema } from '#database/schema'
import Category from '#models/category'
import User from '#models/user'

export default class Post extends PostSchema {
  @column({
    prepare: (value) => JSON.stringify(value),
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare items: Array<{ sku: string; qty: number; price: number }>
  @belongsTo(() => Category) declare category: BelongsTo<typeof Category>
  @belongsTo(() => User, { foreignKey: 'authorId' }) declare author: BelongsTo<typeof User>
}
