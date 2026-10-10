import { BaseCommand, flags } from '@adonisjs/core/ace'
import { configure } from '../configure.js'

export default class InstallCommand extends BaseCommand {
  static commandName = 'pupitre:install'
  static description = 'Install Pupitre host files and configuration'

  @flags.string({ description: 'Panel identifier', default: 'admin' })
  declare panel: string

  @flags.string({ description: 'Panel URL prefix', default: '/admin' })
  declare path: string

  @flags.string({ description: 'Authentication guard', default: 'web' })
  declare auth: string

  async run() {
    await configure({
      app: this.app,
      parsedFlags: this.parsed.flags,
      createCodemods: () => this.createCodemods(),
    })
  }
}
