import { test } from '@japa/runner'
import { EventEmitter } from 'node:events'
import type { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stubsRoot } from '../../../stubs/main.js'
import { scaffoldPluginPackage, writePluginDefinition } from '../../../commands/make_plugin.js'

test('make:plugin writes its stub once and preserves existing files', async ({ assert }) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-make-plugin-'))
  const directory = join(root, 'app/admin/plugins')
  const target = join(directory, 'acme_audit_plugin.ts')
  const template = await readFile(join(stubsRoot, 'make/plugin.stub'), 'utf8')
  try {
    const output = await writePluginDefinition({ target, directory, template, slug: 'acme-audit' })
    assert.isString(output)
    assert.snapshot(output).match()
    assert.isNull(await writePluginDefinition({ target, directory, template, slug: 'different' }))
    assert.equal(await readFile(target, 'utf8'), output)
    const replaced = await writePluginDefinition({
      target,
      directory,
      template,
      slug: 'different',
      force: true,
    })
    assert.include(replaced!, "name: 'different'")
    assert.equal(await readFile(target, 'utf8'), replaced)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('make:plugin --package runs the versioned scaffolder without a shell', async ({ assert }) => {
  const { version } = JSON.parse(
    await readFile(new URL('../../../package.json', import.meta.url), 'utf8')
  ) as { version: string }
  const major = version.split('.')[0]
  const calls: unknown[][] = []
  const mockedSpawn = ((...arguments_: unknown[]) => {
    calls.push(arguments_)
    const child = new EventEmitter()
    queueMicrotask(() => child.emit('close', 0, null))
    return child
  }) as unknown as typeof spawn
  await scaffoldPluginPackage('demo', 'plugins/demo;$(id)', { spawn: mockedSpawn })
  assert.deepEqual(calls, [
    [
      'npx',
      ['--yes', `@rikology/create-pupitre-plugin@${major}`, 'demo', '--dir', 'plugins/demo;$(id)'],
      { stdio: 'inherit', shell: false },
    ],
  ])
  await assert.rejects(() => scaffoldPluginPackage('../escape', undefined, { spawn: mockedSpawn }))
  assert.lengthOf(calls, 1)
})

test('make:plugin --package surfaces subprocess failure', async ({ assert }) => {
  const mockedSpawn = (() => {
    const child = new EventEmitter()
    queueMicrotask(() => child.emit('close', 7, null))
    return child
  }) as unknown as typeof spawn
  await assert.rejects(
    () => scaffoldPluginPackage('demo', undefined, { spawn: mockedSpawn }),
    /code 7/
  )
})
