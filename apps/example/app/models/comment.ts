import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import Post from '#models/post'

export default class Comment extends BaseModel {
  static table = 'comments'

  @column({ isPrimary: true }) declare id: number
  @column() declare title: string
  @column() declare body: string
  @column() declare postId: number | null
  @column() declare tenantId: number | null
  @column() declare rating: number
  @column({
    prepare: (value) => JSON.stringify(value),
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare ratingDetails: Array<{ criterion: string; score: number }>
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime

  @belongsTo(() => Post) declare post: BelongsTo<typeof Post>
}
