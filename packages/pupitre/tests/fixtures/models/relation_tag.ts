import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import RelationPost from './relation_post.js'

export default class RelationTag extends BaseModel {
  static table = 'relation_tags'

  @column({ isPrimary: true }) declare id: number
  @column() declare tenantId: number | null
  @column() declare name: string
  @manyToMany(() => RelationPost, {
    pivotTable: 'relation_post_tags',
    pivotForeignKey: 'tag_id',
    pivotRelatedForeignKey: 'post_id',
    pivotColumns: ['note'],
  })
  declare posts: ManyToMany<typeof RelationPost>
}
