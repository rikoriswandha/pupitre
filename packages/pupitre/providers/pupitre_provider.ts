import { configProvider } from '@adonisjs/core'
import type { ApplicationService } from '@adonisjs/core/types'
import PupitreManager from '../src/manager.js'
import type { PupitreConfig } from '../src/define_config.js'
import { rememberSessionExpiration } from '../src/auth/session_service.js'

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

  async boot() {
    const emitter = await this.app.container.make('emitter')
    // Host auth guards augment EventsList; core cannot assume the host's guard names/types.
    const authEvents = emitter as unknown as {
      on(event: string, listener: typeof rememberSessionExpiration): unknown
    }
    authEvents.on('session_auth:login_succeeded', rememberSessionExpiration)
    authEvents.on('session_auth:authentication_succeeded', rememberSessionExpiration)
  }
}
