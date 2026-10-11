import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import RelationPost from './relation_post.js'

export default class RelationComment extends BaseModel {
  static table = 'relation_comments'

  @column({ isPrimary: true }) declare id: number
  @column() declare postId: number | null
  @column() declare tenantId: number | null
  @column() declare title: string
  @column() declare body: string
  @belongsTo(() => RelationPost, { foreignKey: 'postId' })
  declare post: BelongsTo<typeof RelationPost>
}
