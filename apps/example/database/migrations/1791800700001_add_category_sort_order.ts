import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    if (!(await this.schema.hasColumn('categories', 'sort_order'))) {
      this.schema.alterTable('categories', (table) => {
        table.integer('sort_order').notNullable().defaultTo(0)
      })
    }
  }

  async down() {
    if (await this.schema.hasColumn('categories', 'sort_order')) {
      this.schema.alterTable('categories', (table) => table.dropColumn('sort_order'))
    }
  }
}
