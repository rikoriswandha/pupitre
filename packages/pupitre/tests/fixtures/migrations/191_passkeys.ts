import type { Database } from '@adonisjs/lucid/database'

export async function up(database: Database) {
  const schema = database.connection().schema
  if (await schema.hasTable('pupitre_passkeys')) return
  await schema.createTable('pupitre_passkeys', (table) => {
    table.increments('id')
    table
      .integer('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
    table.string('credential_id', 512).notNullable().unique()
    table.text('public_key').notNullable()
    table.bigInteger('counter').notNullable().defaultTo(0)
    table.json('transports').notNullable().defaultTo('[]')
    table.string('device_type', 32).notNullable()
    table.boolean('backed_up').notNullable().defaultTo(false)
    table.string('name', 100).nullable()
    table.timestamp('last_used_at', { useTz: true }).nullable()
    table.timestamp('created_at', { useTz: true }).notNullable()
    table.timestamp('updated_at', { useTz: true }).notNullable()
    table.index(['user_id'])
  })
}
