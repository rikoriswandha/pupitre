import type { Database } from '@adonisjs/lucid/database'
import { up as tables001 } from './001_tables.js'
import { up as auth010 } from './010_auth.js'
import { up as tenancy020 } from './020_tenancy.js'
import { up as categoryTenant025 } from './025_category_tenant.js'
import { up as exports170 } from './170_exports.js'
import { up as notifications021 } from './021_notifications.js'
import { up as social200 } from './200_social.js'
import { up as mfa190 } from './190_mfa.js'
import { up as passkeys191 } from './191_passkeys.js'
import { up as builderContent101 } from './101_builder_content.js'
import { up as repeaterLinks120 } from './120_repeater_links.js'
import { up as relations140 } from './140_relations.js'
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
  { up: mfa190, tables: [] },
  { up: passkeys191, tables: ['pupitre_passkeys'] },
  { up: notifications021, tables: ['notifications'] },
  { up: social200, tables: [] },
  { up: builderContent101, tables: [] },
  { up: exports170, tables: ['pupitre_exports'] },
  { up: repeaterLinks120, tables: ['post_links'] },
  {
    up: relations140,
    tables: [
      'relation_posts',
      'relation_comments',
      'relation_tags',
      'relation_post_tags',
      'relation_revisions',
    ],
  },
]

/** All fixture tables, children first. */
export function fixtureTables(): string[] {
  return [...fixtureMigrations].reverse().flatMap((migration) => migration.tables)
}
