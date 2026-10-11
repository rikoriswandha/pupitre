import 'reflect-metadata'
import { assert } from '@japa/assert'
import { configure, processCLIArgs, run } from '@japa/runner'

processCLIArgs(process.argv.splice(2))
configure({
  suites: [{ name: 'unit', files: ['tests/**/*.spec.ts'], timeout: 30_000 }],
  plugins: [assert()],
})
await run()
