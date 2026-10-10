import { configProvider } from '@adonisjs/core'
import type { ApplicationService } from '@adonisjs/core/types'
import PupitreManager from '../src/manager.js'
import type { PupitreConfig } from '../src/define_config.js'

export default class PupitreProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('pupitre.config', async () => {
      const config = await configProvider.resolve<PupitreConfig>(
        this.app,
        this.app.config.get('pupitre')
      )
      if (!config) throw new Error('Pupitre configuration must be defined with defineConfig()')
      return config
    })
    this.app.container.singleton('pupitre.manager', () => new PupitreManager(this.app))
  }
}
