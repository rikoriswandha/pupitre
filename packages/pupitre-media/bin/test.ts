import 'reflect-metadata'
import { assert } from '@japa/assert'
import { configure, processCLIArgs, run } from '@japa/runner'

processCLIArgs(process.argv.splice(2))
configure({
  timeout: 30_000,
  suites: [{ name: 'unit', files: ['tests/**/*.spec.ts'] }],
  plugins: [assert()],
})
await run()
