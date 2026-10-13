import { BaseCommand } from '@adonisjs/core/ace'
import { DateTime } from 'luxon'
import { createPupitreStorage } from '../src/storage/index.js'
import type { Database } from '@adonisjs/lucid/database'
import type PupitreManager from '../src/manager.js'

export async function pruneExpiredPasswordResets(database: Database) {
  return database
    .from('pupitre_password_resets')
    .where('expires_at', '<=', DateTime.now().toSQL())
    .delete()
}

export async function pruneExpiredExports(database: Database): Promise<number> {
  const schema = database.connection().schema
  if (!(await schema.hasTable('pupitre_exports'))) return 0
  const expired = await database
    .from('pupitre_exports')
    .where('expires_at', '<=', DateTime.now().toSQL())
    .select('id', 'file_key')
  const storage = createPupitreStorage()
  for (const row of expired) {
    if (typeof row.file_key === 'string' && row.file_key.length > 0)
      await storage.delete(row.file_key)
  }
  if (expired.length === 0) return 0
  const deleted = await database
    .from('pupitre_exports')
    .whereIn(
      'id',
      expired.map((row) => row.id)
    )
    .delete()
  return Number(deleted)
}

export async function pruneBrowserSessions(
  database: Database,
  panels: { id: string; sessions?: { retentionDays: number } }[]
) {
  let deleted = 0
  const schema = database.connection().schema
  if (
    !(await schema.hasTable('pupitre_user_sessions')) ||
    !(await schema.hasTable('pupitre_login_events'))
  )
    return deleted
  for (const panel of panels) {
    if (!panel.sessions) continue
    const cutoff = DateTime.utc().minus({ days: panel.sessions.retentionDays }).toSQL()
    deleted += Number(
      await database
        .from('pupitre_login_events')
        .where('panel', panel.id)
        .where('created_at', '<', cutoff)
        .delete()
    )
    deleted += Number(
      await database
        .from('pupitre_user_sessions')
        .where('panel', panel.id)
        .where((query) => query.whereNotNull('revoked_at').orWhere('last_active_at', '<', cutoff))
        .delete()
    )
  }
  return deleted
}

export default class PupitrePruneCommand extends BaseCommand {
  static commandName = 'pupitre:prune'
  static description = 'Delete expired Pupitre password reset tokens and export files'
  static options = { startApp: true }

  async run() {
    const database = (await this.app.container.make('lucid.db')) as Database
    const deleted = await pruneExpiredPasswordResets(database)
    const exports = await pruneExpiredExports(database)
    const manager = (await this.app.container.make('pupitre.manager')) as PupitreManager
    const sessions = await pruneBrowserSessions(database, [...manager.panels.values()])
    this.logger.info(`Removed ${sessions} expired Pupitre session/history row(s)`)
    this.logger.info(`Removed ${exports} expired Pupitre export(s)`)
    this.logger.info(`Removed ${deleted} expired Pupitre password reset token(s)`)
  }
}
