import type { Database } from '@adonisjs/lucid/database'

export async function up(database: Database) {
  const schema = database.connection().schema
  if (await schema.hasTable('post_links')) return
  await schema.createTable('post_links', (table) => {
    table.increments('id')
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
    table.timestamp('created_at').nullable()
    table.timestamp('updated_at').nullable()
  })
}
