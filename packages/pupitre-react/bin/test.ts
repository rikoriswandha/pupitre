import '../tests/helpers/dom_globals.js'
import { assert } from '@japa/assert'
import { configure, processCLIArgs, run } from '@japa/runner'

processCLIArgs(process.argv.splice(2))

configure({
  files: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
  plugins: [assert()],
})

run()
