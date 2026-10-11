import type { Database } from '@adonisjs/lucid/database'

export async function up(database: Database) {
  const schema = database.connection().schema
  if (!(await schema.hasColumn('posts', 'content'))) {
    await schema.alterTable('posts', (table) => table.json('content').nullable())
  }
}
