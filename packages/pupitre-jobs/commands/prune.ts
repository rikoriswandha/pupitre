import { BaseCommand, flags } from '@adonisjs/core/ace'
import { pruneJobRuns } from '../index.js'
export default class JobsPrune extends BaseCommand {
  static commandName = 'jobs:prune'
  static description = 'Delete completed and failed job runs older than the retention window'
  static options = { startApp: true }
  @flags.number({ description: 'Retention in days' }) declare days: number
  async run() {
    const result = await pruneJobRuns(this.days ?? 7)
    this.logger.success(`Pruned job runs: ${result}`)
  }
}
