import { backup } from '@rikology/pupitre-backup'
import type User from '#models/user'

/** Database-wide snapshots require a system administrator, not merely tenant membership. */
export const databaseBackups = backup({
  disk: 'private',
  directory: 'database-backups',
  keep: { last: 5, days: 30 },
  navigationGroup: 'Administration',
  authorize: (ctx) => (ctx.auth.user as User | undefined)?.email === 'admin@example.com',
})
