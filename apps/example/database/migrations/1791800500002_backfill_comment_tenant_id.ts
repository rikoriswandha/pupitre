import { BaseSchema } from '@adonisjs/lucid/schema'

export default class BackfillCommentTenantId extends BaseSchema {
  protected tableName = 'comments'

  async up() {
    if (!(await this.schema.hasTable(this.tableName))) return
    if (!(await this.schema.hasColumn(this.tableName, 'tenant_id'))) return
    const comments = await this.db.from('comments').select('id', 'post_id').whereNull('tenant_id')
    for (const comment of comments) {
      const post = await this.db
        .from('posts')
        .select('tenant_id')
        .where('id', comment.post_id)
        .first()
      if (post?.tenant_id !== undefined && post?.tenant_id !== null) {
        await this.db.from('comments').where('id', comment.id).update({ tenant_id: post.tenant_id })
      }
    }
  }

  async down() {}
}
