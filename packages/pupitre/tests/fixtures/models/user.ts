import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Post from './post.js'

export default class User extends BaseModel {
  static table = 'users'

  @column({ isPrimary: true }) declare id: number
  @column() declare name: string
  @column() declare email: string
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime

  @hasMany(() => Post, { foreignKey: 'authorId' }) declare posts: HasMany<typeof Post>
}
