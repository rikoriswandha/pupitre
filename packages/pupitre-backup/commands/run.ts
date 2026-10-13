import { BaseCommand, flags } from '@adonisjs/core/ace'
import { registeredBackups, runBackup } from '../index.js'
export default class BackupRun extends BaseCommand {
  static commandName = 'backup:run'
  static description = 'Create a private database backup using a registered panel configuration'
  static options = { startApp: true }
  @flags.string() declare connection?: string
  @flags.string() declare panel?: string
  async run() {
    const options = this.panel
      ? registeredBackups.get(this.panel)
      : registeredBackups.values().next().value
    if (!options) {
      this.logger.error('No backup plugin registered for the selected panel')
      this.exitCode = 1
      return
    }
    try {
      this.logger.success(`Backup completed: ${await runBackup(options, this.connection)}`)
    } catch (error) {
      this.logger.error(
        error instanceof Error && error.name === 'BackupBusy'
          ? 'A backup is already running'
          : 'Backup failed; inspect database and storage configuration'
      )
      this.exitCode = 1
    }
  }
}
