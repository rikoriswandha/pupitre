import { BaseCommand } from '@adonisjs/core/ace'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import type { Database } from '@adonisjs/lucid/database'

export async function pruneExpiredPasswordResets(database: Database) {
  return database
    .from('pupitre_password_resets')
    .where('expires_at', '<=', DateTime.now().toSQL())
    .delete()
}

export default class PupitrePruneCommand extends BaseCommand {
  static commandName = 'pupitre:prune'
  static description = 'Delete expired Pupitre password reset tokens'
  static options = { startApp: true }

  async run() {
    const database = (await app.container.make('lucid.db')) as Database
    const deleted = await pruneExpiredPasswordResets(database)
    this.logger.info(`Removed ${deleted} expired Pupitre password reset token(s)`)
  }
}
