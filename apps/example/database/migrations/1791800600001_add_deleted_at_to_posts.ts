import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddDeletedAtToPosts extends BaseSchema {
  protected tableName = 'posts'

  async up() {
    if (!(await this.schema.hasTable(this.tableName))) return
    if (await this.schema.hasColumn(this.tableName, 'deleted_at')) return
    this.schema.alterTable(this.tableName, (table) => table.timestamp('deleted_at').nullable())
  }

  async down() {
    if (!(await this.schema.hasTable(this.tableName))) return
    if (!(await this.schema.hasColumn(this.tableName, 'deleted_at'))) return
    this.schema.alterTable(this.tableName, (table) => table.dropColumn('deleted_at'))
  }
}
