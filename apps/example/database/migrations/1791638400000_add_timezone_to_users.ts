import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    if (await this.schema.hasColumn(this.tableName, 'timezone')) return
    this.schema.alterTable(this.tableName, (table) => table.string('timezone').nullable())
  }

  async down() {
    if (!(await this.schema.hasColumn(this.tableName, 'timezone'))) return
    this.schema.alterTable(this.tableName, (table) => table.dropColumn('timezone'))
  }
}
