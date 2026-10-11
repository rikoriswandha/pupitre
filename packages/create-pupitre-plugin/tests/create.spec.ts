import { test } from '@japa/runner'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, mkdtemp, readFile, rm, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPlugin, pluginNames } from '../index.js'

const execute = promisify(execFile)

test('writes all template files, replaces tokens and normalizes names', async ({ assert }) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-create-plugin-'))
  try {
    const files = await createPlugin({ name: '@acme/pupitre-demo-tools', directory: root })
    assert.lengthOf(files, 10)
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    assert.equal(manifest.name, '@acme/pupitre-demo-tools')
    assert.property(manifest.peerDependencies, '@rikology/pupitre')
    const source = await readFile(join(root, 'index.ts'), 'utf8')
    assert.include(source, 'function demoTools(options: PluginOptions = {})')
    assert.include(source, "name: 'demo-tools'")
    for (const file of files) assert.notMatch(await readFile(file, 'utf8'), /\{\{[^}]+\}\}/)
    assert.include(files, join(root, '.gitignore'))
    assert.equal(pluginNames('default').camelName, 'defaultPlugin')
    assert.equal(pluginNames('constructor').camelName, 'constructor')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects invalid names before writing files', async ({ assert }) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-create-invalid-'))
  try {
    for (const name of [
      'Bad Name',
      '../escape',
      'demo_tools',
      '2demo',
      '@BAD/demo',
      'demo-',
      'pupitre-',
    ]) {
      await assert.rejects(
        () => createPlugin({ name, directory: join(root, 'target') }),
        /kebab-case/
      )
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('refuses non-empty directories unless forced and preserves unrelated files', async ({
  assert,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-create-existing-'))
  try {
    await writeFile(join(root, 'keep.txt'), 'keep')
    await assert.rejects(() => createPlugin({ name: 'demo', directory: root }), /not empty/)
    await createPlugin({ name: 'demo', directory: root, force: true })
    await writeFile(join(root, 'index.ts'), 'custom source')
    await assert.rejects(() => createPlugin({ name: 'demo', directory: root }), /not empty/)
    await createPlugin({ name: 'demo', directory: root, force: true })
    assert.include(await readFile(join(root, 'index.ts'), 'utf8'), 'function demo(')
    assert.equal(await readFile(join(root, 'keep.txt'), 'utf8'), 'keep')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('generated package npm test resolves Pupitre from its published build only', async ({
  assert,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-plugin-published-'))
  try {
    await createPlugin({ name: 'demo', directory: root })
    const modules = new URL('../../../node_modules/', import.meta.url).pathname
    const dependencies = join(root, 'node_modules')
    await mkdir(join(dependencies, '@rikology'), { recursive: true })
    const { stdout } = await execute(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', root],
      { cwd: new URL('../../pupitre/', import.meta.url).pathname }
    )
    const tarball = JSON.parse(stdout)[0].filename
    await execute('tar', ['-xzf', join(root, tarball), '-C', root])
    await symlink(modules, join(root, 'package/node_modules'))
    await symlink(join(root, 'package'), join(dependencies, '@rikology/pupitre'))
    for (const name of [
      '@adonisjs',
      '@japa',
      '@poppinss',
      '@types',
      'reflect-metadata',
      'tsdown',
      'typescript',
    ])
      await symlink(join(modules, name), join(dependencies, name))
    const result = await execute('npm', ['test'], {
      cwd: root,
      env: { ...process.env, NODE_OPTIONS: '' },
    }).catch((error: Error & { stdout?: string; stderr?: string }) => {
      throw new Error(`${error.message}\n${error.stdout ?? ''}\n${error.stderr ?? ''}`)
    })
    assert.include(result.stdout, '1 passed')
    assert.notInclude(result.stdout.toLowerCase(), 'failed')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects directory traversal and forced symlink escapes', async ({ assert }) => {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-create-security-'))
  try {
    for (const directory of [join(root, 'nested') + '/../escape', 'nested\\..\\escape', ''])
      await assert.rejects(() => createPlugin({ name: 'demo', directory }), /traversal/)
    const outside = join(root, 'outside')
    await mkdir(outside)
    const target = join(root, 'target')
    await symlink(outside, target)
    await assert.rejects(
      () => createPlugin({ name: 'demo', directory: target, force: true }),
      /symlink/
    )
    const safe = join(root, 'safe')
    await mkdir(safe)
    const secret = join(outside, 'secret')
    await writeFile(secret, 'do not overwrite')
    await symlink(secret, join(safe, 'index.ts'))
    await assert.rejects(
      () => createPlugin({ name: 'demo', directory: safe, force: true }),
      /symlink/
    )
    assert.equal(await readFile(secret, 'utf8'), 'do not overwrite')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
