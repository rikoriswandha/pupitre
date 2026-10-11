import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddPostSummary extends BaseSchema {
  protected tableName = 'posts'

  async up() {
    if (!(await this.schema.hasTable(this.tableName))) return
    if (!(await this.schema.hasColumn(this.tableName, 'summary'))) {
      this.schema.alterTable(this.tableName, (table) => table.text('summary').nullable())
    }
  }

  async down() {
    if (
      (await this.schema.hasTable(this.tableName)) &&
      (await this.schema.hasColumn(this.tableName, 'summary'))
    ) {
      this.schema.alterTable(this.tableName, (table) => table.dropColumn('summary'))
    }
  }
}
