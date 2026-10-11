import { belongsTo, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import { PostSchema } from '#database/schema'
import Category from '#models/category'
import Comment from '#models/comment'
import User from '#models/user'
import PostLink from '#models/post_link'
import Tag from '#models/tag'
import Revision from '#models/revision'

export default class Post extends PostSchema {
  @column({
    prepare: (value) => JSON.stringify(value),
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare items: Array<{ sku: string; qty: number; price: number }>
  @column({
    prepare: (value) => JSON.stringify(value),
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare content: Array<{ _key: string; type: string; data: Record<string, unknown> }>
  @belongsTo(() => Category) declare category: BelongsTo<typeof Category>
  @belongsTo(() => User, { foreignKey: 'authorId' }) declare author: BelongsTo<typeof User>
  @column.dateTime() declare deletedAt: DateTime | null
  @column() declare priority: number
  @column() declare excerpt: string
  @column() declare contactPhone: string | null
  @column() declare website: string | null
  @hasMany(() => PostLink) declare links: HasMany<typeof PostLink>
  @hasMany(() => Comment) declare comments: HasMany<typeof Comment>
  @manyToMany(() => Tag, { pivotTable: 'post_tags', pivotColumns: ['note'] })
  declare tags: ManyToMany<typeof Tag>
  @hasMany(() => Revision) declare revisions: HasMany<typeof Revision>
}
