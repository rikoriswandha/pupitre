import 'reflect-metadata'
import { assert } from '@japa/assert'
import { configure, processCLIArgs, run } from '@japa/runner'
import { Settings } from 'luxon'
import { teardown } from '../../pupitre/tests/helpers/db.js'

processCLIArgs(process.argv.splice(2))
configure({
  suites: [{ name: 'unit', files: ['tests/**/*.spec.ts'], timeout: 30_000 }],
  plugins: [assert()],
})
const previousZone = Settings.defaultZone
Settings.defaultZone = 'UTC'
try {
  await run()
} finally {
  Settings.defaultZone = previousZone
  await teardown()
}
