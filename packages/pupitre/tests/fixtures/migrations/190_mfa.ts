import type { Database } from '@adonisjs/lucid/database'

export async function up(database: Database) {
  const schema = database.connection().schema
  if (!(await schema.hasTable('users'))) return
  const columns = ['mfa_secret', 'mfa_recovery_codes', 'mfa_enabled_at']
  const missing: string[] = []
  for (const column of columns) {
    if (!(await schema.hasColumn('users', column))) missing.push(column)
  }
  if (!missing.length) return
  await schema.alterTable('users', (table) => {
    for (const column of missing) {
      if (column === 'mfa_enabled_at') table.timestamp(column, { useTz: true }).nullable()
      else table.text(column).nullable()
    }
  })
}
