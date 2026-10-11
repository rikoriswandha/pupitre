import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateRevisionsTable extends BaseSchema {
  protected tableName = 'revisions'

  async up() {
    if (await this.schema.hasTable(this.tableName)) return
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('post_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('posts')
        .onDelete('CASCADE')
      table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants')
      table.string('title').notNullable()
      table.text('body').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    if (await this.schema.hasTable(this.tableName)) this.schema.dropTable(this.tableName)
  }
}
