import { BaseSchema } from '@adonisjs/lucid/schema'
import type { Knex } from 'knex'

export default class AddSchemaParityToPosts extends BaseSchema {
  protected tableName = 'posts'

  async up() {
    if (!(await this.schema.hasTable(this.tableName))) return
    const additions: Array<[string, (table: Knex.TableBuilder) => void]> = [
      ['priority', (table) => table.integer('priority').notNullable().defaultTo(0)],
      ['excerpt', (table) => table.text('excerpt').notNullable().defaultTo('')],
      ['contact_phone', (table) => table.string('contact_phone').nullable()],
      ['website', (table) => table.string('website').nullable()],
    ]
    for (const [column, define] of additions) {
      if (!(await this.schema.hasColumn(this.tableName, column))) {
        this.schema.alterTable(this.tableName, define)
      }
    }
    if (!(await this.schema.hasTable('post_links'))) {
      this.schema.createTable('post_links', (table) => {
        table.increments('id').notNullable()
        table
          .integer('post_id')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('posts')
          .onDelete('CASCADE')
        table.string('label').notNullable()
        table.string('url').notNullable()
        table.integer('sort').notNullable().defaultTo(0)
        table.timestamp('created_at').notNullable()
        table.timestamp('updated_at').nullable()
      })
    }
  }

  async down() {
    if (await this.schema.hasTable('post_links')) this.schema.dropTable('post_links')
    for (const column of ['website', 'contact_phone', 'excerpt', 'priority']) {
      if (
        (await this.schema.hasTable(this.tableName)) &&
        (await this.schema.hasColumn(this.tableName, column))
      ) {
        this.schema.alterTable(this.tableName, (table) => table.dropColumn(column))
      }
    }
  }
}
