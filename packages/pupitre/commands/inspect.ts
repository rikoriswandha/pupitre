import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { PupitreConfig } from '../src/define_config.js'
import type PupitreManager from '../src/manager.js'
import { buildPolicyInspection } from '../src/inspect/report.js'

export default class InspectCommand extends BaseCommand {
  static commandName = 'pupitre:inspect'
  static description = 'Inspect authorization policies used by Pupitre panels'
  static options = { startApp: true }

  @args.string({ description: 'Limit output to one resource slug', required: false })
  declare resource: string | undefined

  @flags.boolean({ description: 'Print machine-readable JSON' })
  declare json: boolean

  async run() {
    const [managerModule, config] = await Promise.all([
      import('../services/main.js'),
      this.app.container.make('pupitre.config').catch(() => undefined),
    ])
    const manager = managerModule.default as PupitreManager
    const report = await buildPolicyInspection(
      manager.panels,
      config as PupitreConfig,
      this.resource
    )
    if (this.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
      return
    }
    for (const item of report) {
      this.logger.info(`${item.panel}.${item.resource} (${item.model})`)
      this.logger.info(
        item.allowByDefault
          ? '  WARNING: no policy found; authorization allows by default'
          : `  Policy: ${item.policy}`
      )
      this.logger.info(
        `  Searchable columns: ${item.searchableColumns.length ? item.searchableColumns.join(', ') : 'none'}`
      )
      if (item.missingAbilities.length) {
        this.logger.warning(`  Policy is missing abilities: ${item.missingAbilities.join(', ')}`)
      } else if (!item.allowByDefault) {
        this.logger.info('  Required abilities: complete')
      }
    }
  }
}
