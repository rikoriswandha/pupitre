import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddTenantIdToComments extends BaseSchema {
  protected tableName = 'comments'

  async up() {
    if (!(await this.schema.hasTable(this.tableName))) return
    if (!(await this.schema.hasColumn(this.tableName, 'tenant_id'))) {
      this.schema.alterTable(this.tableName, (table) => {
        table.integer('tenant_id').unsigned().nullable().references('id').inTable('tenants')
      })
    }
  }

  async down() {
    if (
      (await this.schema.hasTable(this.tableName)) &&
      (await this.schema.hasColumn(this.tableName, 'tenant_id'))
    ) {
      this.schema.alterTable(this.tableName, (table) => table.dropColumn('tenant_id'))
    }
  }
}
