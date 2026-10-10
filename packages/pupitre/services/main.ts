import app from '@adonisjs/core/services/app'
import type PupitreManager from '../src/manager.js'

let manager: PupitreManager
await app?.booted(async () => {
  manager = await app.container.make('pupitre.manager')
})

export { manager as default }
export type { PupitreManager }
