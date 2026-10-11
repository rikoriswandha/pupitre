import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import Post from '#models/post'

export default class Tag extends BaseModel {
  static table = 'tags'

  @column({ isPrimary: true }) declare id: number
  @column() declare name: string
  @column() declare slug: string
  @column() declare tenantId: number
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime

  @manyToMany(() => Post, { pivotTable: 'post_tags', pivotColumns: ['note'] })
  declare posts: ManyToMany<typeof Post>
}
