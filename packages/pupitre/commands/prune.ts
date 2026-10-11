import { BaseCommand } from '@adonisjs/core/ace'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import { createPupitreStorage } from '../src/storage/index.js'
import type { Database } from '@adonisjs/lucid/database'

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

export default class PupitrePruneCommand extends BaseCommand {
  static commandName = 'pupitre:prune'
  static description = 'Delete expired Pupitre password reset tokens and export files'

  async run() {
    const database = (await app.container.make('lucid.db')) as Database
    const deleted = await pruneExpiredPasswordResets(database)
    const exports = await pruneExpiredExports(database)
    this.logger.info(`Removed ${exports} expired Pupitre export(s)`)
    this.logger.info(`Removed ${deleted} expired Pupitre password reset token(s)`)
  }
}
