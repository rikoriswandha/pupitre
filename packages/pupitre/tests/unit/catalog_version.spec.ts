import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import { catalogVersion } from '../../catalog/index.js'

test.group('catalogVersion', () => {
  test('matches major.minor of the package version', async ({ assert }) => {
    const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf-8'))
    const [major, minor] = pkg.version.split('.')
    assert.equal(catalogVersion, `${major}.${minor}`)
  })
})
