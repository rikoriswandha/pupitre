import type { Database } from '@adonisjs/lucid/database'
import { up as tables001 } from './001_tables.js'
import { up as auth010 } from './010_auth.js'
import { up as tenancy020 } from './020_tenancy.js'
import { up as categoryTenant025 } from './025_category_tenant.js'
import { up as notifications021 } from './021_notifications.js'
/**
 * Fixture migrations applied in order to the shared test database. Each entry
 * lists the tables it owns (dropped on `DB=pg` reset, children before parents,
 * and truncated by `truncate()`). Feature suites append their own entry.
 */
export const fixtureMigrations: { up(database: Database): Promise<void>; tables: string[] }[] = [
  { up: tables001, tables: ['posts', 'categories', 'users'] },
  { up: auth010, tables: ['pupitre_password_resets'] },
  { up: tenancy020, tables: ['tenant_user', 'tenants'] },
  { up: categoryTenant025, tables: [] },
  { up: notifications021, tables: ['notifications'] },
]

/** All fixture tables, children first. */
export function fixtureTables(): string[] {
  return [...fixtureMigrations].reverse().flatMap((migration) => migration.tables)
}
