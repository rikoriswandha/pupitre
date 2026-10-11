import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Post from '#models/post'
import type { DateTime } from 'luxon'

export default class PostLink extends BaseModel {
  static table = 'post_links'

  @column({ isPrimary: true }) declare id: number
  @column() declare postId: number
  @column() declare label: string
  @column() declare url: string
  @column() declare sort: number
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime | null
  @belongsTo(() => Post) declare post: BelongsTo<typeof Post>
}
