import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { panelShieldOptions } from '../src/plugin.js'
import { syncPermissions } from '../src/sync.js'
export default class ShieldSync extends BaseCommand {
  static commandName = 'shield:sync'
  static description = 'Synchronize panel permissions and optionally assign a super administrator'
  static options: CommandOptions = { startApp: true }
  @flags.string({ description: 'Super-admin user ID or email' }) declare user?: string
  async run() {
    const { default: manager } = await import('@rikology/pupitre/services/main')
    const panels = manager.panels
    const names = await syncPermissions(panels)
    for (const panel of panels) {
      const options = panelShieldOptions.get(panel)
      if (options) await syncPermissions([panel], options, this.user)
    }
    this.logger.success('Synchronized ' + names.length + ' permissions')
  }
}
