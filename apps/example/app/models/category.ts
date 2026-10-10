import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { CategorySchema } from '#database/schema'
import Post from '#models/post'

export default class Category extends CategorySchema {
  @hasMany(() => Post) declare posts: HasMany<typeof Post>
}
