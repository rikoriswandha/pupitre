import type { Database } from '@adonisjs/lucid/database'

export async function up(database: Database) {
  const schema = database.connection().schema
  if (await schema.hasTable('pupitre_exports')) return
  await schema.createTable('pupitre_exports', (table) => {
    table.uuid('id').primary()
    table
      .integer('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
    table.string('tenant_id').nullable()
    table.string('resource').notNullable()
    table.string('status', 20).notNullable().defaultTo('queued')
    table.integer('total_rows').notNullable().defaultTo(0)
    table.integer('processed_rows').notNullable().defaultTo(0)
    table.string('file_key').nullable()
    table.text('result').nullable()
    table.text('error').nullable()
    table.timestamp('created_at', { useTz: true }).notNullable()
    table.timestamp('updated_at', { useTz: true }).notNullable()
    table.timestamp('expires_at', { useTz: true }).notNullable()
  })
}
