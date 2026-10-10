import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Post from './post.js'

export default class Category extends BaseModel {
  static table = 'categories'

  @column({ isPrimary: true }) declare id: number
  @column() declare name: string
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime

  @hasMany(() => Post) declare posts: HasMany<typeof Post>
}
