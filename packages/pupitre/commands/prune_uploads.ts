import { BaseCommand, flags } from '@adonisjs/core/ace'
import { pruneTrackedUploads } from '../src/storage/upload_tracking.js'

export default class PruneUploads extends BaseCommand {
  static commandName = 'pupitre:prune-uploads'
  static description =
    'Delete old unconsumed Pupitre uploads (process at most 100, examine at most 1000 per invocation)'
  static options = { startApp: true }

  @flags.string({ description: 'Minimum age, e.g. 24h or 7d', default: '24h' })
  declare olderThan: string

  async run() {
    const match = /^(\d+)(h|d)$/.exec(this.olderThan)
    if (!match || Number(match[1]) < 1 || !Number.isSafeInteger(Number(match[1]))) {
      this.logger.error('--older-than must be a positive integer followed by h or d')
      this.exitCode = 1
      return
    }
    try {
      let skipped = 0
      const deleted = await pruneTrackedUploads(
        Number(match[1]) * (match[2] === 'd' ? 86400000 : 3600000),
        100,
        (error, key) => {
          this.logger.error(`Unable to prune ${key}: ${String(error)}`)
          this.exitCode = 1
        },
        () => {
          skipped++
        }
      )
      this.logger.info(
        `Pruned ${deleted} abandoned uploads; skipped ${skipped} conservatively retained uploads`
      )
    } catch (error) {
      this.logger.error(String(error))
      this.exitCode = 1
    }
  }
}
