import { BaseModel, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import RelationComment from './relation_comment.js'
import RelationTag from './relation_tag.js'
import RelationRevision from './relation_revision.js'

export default class RelationPost extends BaseModel {
  static table = 'relation_posts'

  @column({ isPrimary: true }) declare id: number
  @column() declare tenantId: number
  @column() declare title: string
  @hasMany(() => RelationComment, { foreignKey: 'postId' })
  declare comments: HasMany<typeof RelationComment>
  @hasMany(() => RelationRevision, { foreignKey: 'postId' })
  declare revisions: HasMany<typeof RelationRevision>
  @manyToMany(() => RelationTag, {
    pivotTable: 'relation_post_tags',
    pivotForeignKey: 'post_id',
    pivotRelatedForeignKey: 'tag_id',
    pivotColumns: ['note'],
  })
  declare tags: ManyToMany<typeof RelationTag>
}
