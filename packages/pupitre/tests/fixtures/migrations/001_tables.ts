import type { Database } from '@adonisjs/lucid/database'
import type { Knex } from 'knex'

async function createIfMissing(
  database: Database,
  name: string,
  build: (table: Knex.CreateTableBuilder) => void
) {
  const schema = database.connection().schema
  if (await schema.hasTable(name)) return
  try {
    await schema.createTable(name, build)
  } catch (error) {
    if (!(await schema.hasTable(name))) throw error
  }
}

export async function up(database: Database) {
  await createIfMissing(database, 'users', (table) => {
    table.increments('id')
    table.string('name').notNullable()
    table.string('full_name').nullable()
    table.string('email').notNullable().unique()
    table.string('password').nullable()
    table.timestamp('email_verified_at', { useTz: true }).nullable()
    table.string('avatar').nullable()
    table.string('timezone', 64).nullable()
    table.string('provider').nullable()
    table.string('provider_id').nullable()
    table.timestamp('mfa_enabled_at', { useTz: true }).nullable()
    table.text('mfa_secret').nullable()
    table.text('mfa_recovery_codes').nullable()
    table.timestamps(true, true)
  })
  await createIfMissing(database, 'categories', (table) => {
    table.increments('id')
    table.string('name').notNullable()
    table.timestamps(true, true)
  })
  await createIfMissing(database, 'posts', (table) => {
    table.increments('id')
    table.string('title').notNullable()
    table.string('slug').notNullable()
    table.string('status').notNullable().defaultTo('draft')
    table.text('body').nullable()
    table.boolean('is_featured').notNullable().defaultTo(false)
    table.timestamp('published_at', { useTz: true }).nullable()
    table.integer('views_count').notNullable().defaultTo(0)
    table.integer('author_id').unsigned().nullable().references('id').inTable('users')
    table.integer('category_id').unsigned().nullable().references('id').inTable('categories')
    table.json('metadata').nullable()
    table.json('items').nullable()
    table.string('cover').nullable()
    table.string('private_cover').nullable()
    table.integer('tenant_id').nullable()
    table.timestamp('deleted_at', { useTz: true }).nullable()
    table.timestamps(true, true)
  })
}
