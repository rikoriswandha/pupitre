import 'reflect-metadata'
import { assert } from '@japa/assert'
import { configure, processCLIArgs, run } from '@japa/runner'
import { IgnitorFactory } from '@adonisjs/core/factories'
import { teardown } from '../../pupitre/tests/helpers/db.js'
const application = new IgnitorFactory()
  .withCoreConfig()
  .withCoreProviders()
  .create(new URL('../', import.meta.url))
  .createApp('test')
await application.init()
await application.boot()

processCLIArgs(process.argv.splice(2))
configure({
  suites: [{ name: 'unit', files: ['tests/**/*.spec.ts'], timeout: 30_000 }],
  plugins: [assert()],
})
try {
  await run()
} finally {
  await teardown()
  await application.terminate()
}
