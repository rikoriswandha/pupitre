import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    if (!(await this.schema.hasColumn('posts', 'content'))) {
      this.schema.alterTable('posts', (table) =>
        table.json('content').notNullable().defaultTo('[]')
      )
    }
  }

  async down() {
    if (await this.schema.hasColumn('posts', 'content')) {
      this.schema.alterTable('posts', (table) => table.dropColumn('content'))
    }
  }
}
