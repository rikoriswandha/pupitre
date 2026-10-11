import type { Database } from '@adonisjs/lucid/database'
import type { Knex } from 'knex'

async function createIfMissing(
  database: Database,
  tableName: string,
  build: (table: Knex.CreateTableBuilder) => void
) {
  const schema = database.connection().schema
  if (await schema.hasTable(tableName)) return
  try {
    await schema.createTable(tableName, build)
  } catch (error) {
    if (!(await schema.hasTable(tableName))) throw error
  }
}

export async function up(database: Database) {
  await createIfMissing(database, 'tenants', (table) => {
    table.increments('id').notNullable()
    table.string('name').notNullable()
    table.string('slug').notNullable().unique()
    table.timestamps(true, true)
  })
  await createIfMissing(database, 'tenant_user', (table) => {
    table.increments('id').notNullable()
    table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants')
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users')
    table.unique(['tenant_id', 'user_id'])
    table.timestamps(true, true)
  })
}
