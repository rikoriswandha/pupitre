import { test } from '@japa/runner'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeClusterDefinition } from '../../../commands/make_cluster.js'
import { stubsRoot } from '../../../stubs/main.js'

test('cluster generator snapshots output, preserves existing files and supports force', async ({
  assert,
}) => {
  const directory = await mkdtemp(join(tmpdir(), 'pupitre-cluster-'))
  try {
    const options = {
      directory,
      target: join(directory, 'settings_cluster.ts'),
      template: await readFile(join(stubsRoot, 'make/cluster.stub'), 'utf8'),
      slug: 'settings',
      label: 'Settings',
    }
    const output = await writeClusterDefinition(options)
    assert.snapshot(output).match()
    assert.isNull(await writeClusterDefinition({ ...options, label: 'Changed' }))
    assert.equal(await readFile(options.target, 'utf8'), output)
    await writeClusterDefinition({ ...options, label: 'Changed', force: true })
    assert.include(await readFile(options.target, 'utf8'), '.label("Changed")')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
