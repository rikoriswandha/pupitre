import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AllowCommentDissociation extends BaseSchema {
  protected tableName = 'comments'

  async up() {
    if (!(await this.schema.hasTable(this.tableName))) return
    if (!(await this.schema.hasColumn(this.tableName, 'post_id'))) return
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('post_id').unsigned().nullable().alter()
    })
  }

  async down() {
    if (!(await this.schema.hasTable(this.tableName))) return
    if (!(await this.schema.hasColumn(this.tableName, 'post_id'))) return
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('post_id').unsigned().notNullable().alter()
    })
  }
}
