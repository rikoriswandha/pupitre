import type { Database } from '@adonisjs/lucid/database'

export async function up(database: Database) {
  const schema = database.connection().schema
  if (!(await schema.hasTable('users'))) return
  const missing: string[] = []
  for (const column of ['provider', 'provider_id']) {
    if (!(await schema.hasColumn('users', column))) missing.push(column)
  }
  if (!missing.length) return
  await schema.alterTable('users', (table) => {
    for (const column of missing) table.string(column).nullable()
  })
}
