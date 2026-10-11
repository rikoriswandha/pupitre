import type { Database } from '@adonisjs/lucid/database'

export async function up(database: Database) {
  const schema = database.connection().schema
  if (!(await schema.hasColumn('categories', 'tenant_id'))) {
    await schema.alterTable('categories', (table) => table.integer('tenant_id').nullable())
  }
}
