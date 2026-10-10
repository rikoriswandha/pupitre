import 'reflect-metadata'
import { assert } from '@japa/assert'
import { snapshot } from '@japa/snapshot'
import { fileSystem } from '@japa/file-system'
import { expectTypeOf } from '@japa/expect-type'
import { configure, processCLIArgs, run } from '@japa/runner'
import { teardown } from '../tests/helpers/db.js'
processCLIArgs(process.argv.splice(2))

configure({
  suites: [
    { name: 'unit', files: ['tests/unit/**/*.spec.ts'] },
    { name: 'integration', files: ['tests/integration/**/*.spec.ts'], timeout: 30_000 },
  ],
  plugins: [
    assert(),
    snapshot(),
    expectTypeOf(),
    fileSystem({ basePath: new URL('../tmp/fs/', import.meta.url) }),
  ],
})

try {
  await run()
} finally {
  await teardown()
}
