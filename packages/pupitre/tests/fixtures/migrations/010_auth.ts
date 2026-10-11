import type { Database } from '@adonisjs/lucid/database'
import type { Knex } from 'knex'

async function createIfMissing(database: Database) {
  const schema = database.connection().schema
  if (await schema.hasTable('pupitre_password_resets')) return
  try {
    await schema.createTable('pupitre_password_resets', (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('guard', 50).notNullable()
      table.string('token_hash', 64).notNullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.unique(['token_hash'], 'pupitre_password_resets_token_hash_unique')
      table.index(['user_id', 'guard'], 'pupitre_password_resets_user_guard_index')
    })
  } catch (error) {
    if (!(await schema.hasTable('pupitre_password_resets'))) throw error
  }
}

export async function up(database: Database) {
  const schema = database.connection().schema
  await createIfMissing(database)
  if (!(await schema.hasTable('users'))) return

  const columns: Record<string, (table: Knex.AlterTableBuilder) => void> = {
    password: (table) => table.string('password').nullable(),
    email_verified_at: (table) => table.timestamp('email_verified_at', { useTz: true }).nullable(),
    avatar: (table) => table.string('avatar').nullable(),
    timezone: (table) => table.string('timezone', 64).nullable(),
    current_tenant_id: (table) => table.integer('current_tenant_id').unsigned().nullable(),
  }
  for (const [column, define] of Object.entries(columns)) {
    if (await schema.hasColumn('users', column)) continue
    try {
      await schema.alterTable('users', define)
    } catch (error) {
      if (!(await schema.hasColumn('users', column))) throw error
    }
  }
}
