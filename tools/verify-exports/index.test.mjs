import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { checkDependencies, runtimeImports } from './dependencies.mjs'
import { checkPackedFiles } from './packaging.mjs'

test('finds static imports, re-exports, literal dynamic imports and require without comment false positives', () => {
  assert.deepEqual(
    runtimeImports(`
    // import 'fake-comment'
    const text = "import 'fake-string'";
    import 'react'; export { x } from 'zod/v4';
    void import('@optional/adapter'); require('node:fs');
  `),
    ['react', 'zod/v4', '@optional/adapter', 'node:fs']
  )
})

test('verifier CLI rejects a deliberately undeclared import in a temporary package copy', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'pupitre-exports-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(join(dir, 'build'))
  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'fixture', devDependencies: { 'undeclared-runtime': '*' } })
  )
  await writeFile(join(dir, 'build/index.js'), "import 'undeclared-runtime'\n")
  const failed = spawnSync(
    process.execPath,
    [resolve('tools/verify-exports/index.mjs'), '--package', dir],
    { encoding: 'utf8' }
  )
  assert.equal(failed.status, 1)
  assert.match(failed.stderr, /undeclared runtime import undeclared-runtime/)
  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      peerDependencies: { 'undeclared-runtime': '*' },
      peerDependenciesMeta: { 'undeclared-runtime': { optional: true } },
    })
  )
  assert.deepEqual((await checkDependencies(dir)).errors, [])
  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'fixture', dependencies: { 'undeclared-runtime': '*' } })
  )
  assert.match((await checkDependencies(dir)).errors[0], /does not resolve/)
})

test('installed optional peers must expose the imported runtime subpath', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'pupitre-optional-peer-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(join(dir, 'build'))
  await mkdir(join(dir, 'node_modules/adapter'), { recursive: true })
  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      peerDependencies: { adapter: '*' },
      peerDependenciesMeta: { adapter: { optional: true } },
    })
  )
  await writeFile(
    join(dir, 'node_modules/adapter/package.json'),
    JSON.stringify({
      name: 'adapter',
      exports: { '.': './index.js' },
    })
  )
  await writeFile(join(dir, 'node_modules/adapter/index.js'), 'export const adapter = true')
  await writeFile(join(dir, 'build/index.js'), "import 'adapter/missing'")
  assert.match((await checkDependencies(dir)).errors[0], /ERR_PACKAGE_PATH_NOT_EXPORTED/)
})

test('tarballs reject temporary declarations while preserving generator template tests', () => {
  const required = [
    'build/commands/commands.json',
    'build/stubs/main.js',
    'build/stubs/config/pupitre.stub',
  ]
  const clean = required.map((path) => ({ path }))
  assert.deepEqual(checkPackedFiles('@rikology/pupitre', clean), [])
  assert.match(
    checkPackedFiles('@rikology/pupitre', [
      ...clean,
      { path: 'build/tmp/configure/start/kernel.d.ts' },
    ])[0],
    /unwanted packed file/
  )
  assert.ok(
    checkPackedFiles('@rikology/pupitre', []).some((error) => /missing release asset/.test(error))
  )
  const template = [
    'build/bin/create.js',
    'template/package.json',
    'template/tests/plugin.spec.ts',
    'template-ui/package.json',
    'template-ui/tests/plugin.spec.ts',
  ].map((path) => ({ path }))
  assert.deepEqual(checkPackedFiles('@rikology/create-pupitre-plugin', template), [])
})

test('declaration build excludes configure-test temporary trees', async () => {
  const config = JSON.parse(await readFile(resolve('packages/pupitre/tsconfig.build.json'), 'utf8'))
  assert.ok(config.exclude.includes('tmp'))
  const pkg = JSON.parse(await readFile(resolve('packages/pupitre/package.json'), 'utf8'))
  assert.ok(pkg.files.includes('!build/tmp'))
})
