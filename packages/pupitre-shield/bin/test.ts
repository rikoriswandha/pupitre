import 'reflect-metadata'
import { assert } from '@japa/assert'
import { configure, processCLIArgs, run } from '@japa/runner'
import { teardown } from '../../pupitre/tests/helpers/db.js'
processCLIArgs(process.argv.splice(2))
configure({
  suites: [{ name: 'integration', files: ['tests/**/*.spec.ts'], timeout: 30000 }],
  plugins: [assert()],
})
try {
  await run()
} finally {
  await teardown()
}
