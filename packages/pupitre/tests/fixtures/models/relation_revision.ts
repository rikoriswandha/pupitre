import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import RelationPost from './relation_post.js'

export default class RelationRevision extends BaseModel {
  static table = 'relation_revisions'

  @column({ isPrimary: true }) declare id: number
  @column() declare postId: number
  @column() declare title: string
  @column() declare body: string
  @belongsTo(() => RelationPost, { foreignKey: 'postId' })
  declare post: BelongsTo<typeof RelationPost>
}
