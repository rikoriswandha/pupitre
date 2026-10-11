import type { Database } from '@adonisjs/lucid/database'

export async function up(database: Database) {
  const schema = database.connection().schema
  if (await schema.hasTable('notifications')) return
  await schema.createTable('notifications', (table) => {
    table.uuid('id').primary()
    table.string('type').notNullable()
    table.string('notifiable_type').notNullable()
    table.string('notifiable_id').notNullable()
    table.json('data').notNullable()
    table.json('metadata').nullable()
    table.timestamp('read_at', { useTz: true }).nullable()
    table.timestamp('seen_at', { useTz: true }).nullable()
    table.timestamp('created_at', { useTz: true }).notNullable()
    table.timestamp('updated_at', { useTz: true }).nullable()
    table.index(['notifiable_type', 'notifiable_id', 'read_at'])
    table.index(['notifiable_type', 'notifiable_id', 'created_at'])
    table.index('type')
  })
}
