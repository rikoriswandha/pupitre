/**
 * Imports every built subpath export of every publishable package and asserts
 * its shape. Also proves `@rikology/pupitre/catalog` loads with nothing but
 * `zod` available (docs/ARCHITECTURE.md §1).
 *
 * Run after `npm run build`.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checkDependencies } from './dependencies.mjs'
import { checkPackedFiles } from './packaging.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const packages = [
  'packages/pupitre',
  'packages/pupitre-react',
  'packages/pupitre-ui',
  'packages/pupitre-shield',
  'packages/pupitre-audit',
  'packages/pupitre-transmit',
  'packages/create-pupitre-plugin',
]

// Declaration-only mode supports checking an isolated unpacked package fixture.
if (process.argv[2] === '--package') {
  const result = await checkDependencies(process.argv[3])
  for (const error of result.errors) console.error(error)
  console.log(`${result.files} runtime files, ${result.errors.length} dependency errors`)
  process.exit(result.errors.length ? 1 : 0)
}

/**
 * Optional shape checks per `<package name><subpath>`. Subpaths without an
 * entry only need to import cleanly.
 */
const shapeChecks = {
  '@rikology/pupitre': (mod) => {
    assert.equal(typeof mod.configure, 'function')
    assert.equal(typeof mod.stubsRoot, 'string')
  },
  '@rikology/pupitre/hooks': (mod) => {
    assert.equal(typeof mod.indexAdmin, 'function')
  },
  '@rikology/pupitre/catalog': (mod) => {
    assert.match(mod.catalogVersion, /^\d+\.\d+$/)
  },
  '@rikology/pupitre/pupitre_provider': (mod) => {
    assert.equal(typeof mod.default, 'function')
  },
  '@rikology/pupitre/commands': (mod) => {
    assert.equal(typeof mod.getMetaData, 'function')
    assert.equal(typeof mod.getCommand, 'function')
  },
  '@rikology/pupitre/testing': (mod) => {
    assert.equal(typeof mod.assertSpecHas, 'function')
    assert.equal(typeof mod.assertVisible, 'function')
    assert.equal(typeof mod.assertHidden, 'function')
  },
  '@rikology/pupitre-ui/testing': (mod) => {
    assert.equal(typeof mod.pupitreTest, 'function')
    assert.equal(typeof mod.AdminPage, 'function')
  },
  '@rikology/pupitre-shield': (mod) => {
    assert.equal(typeof mod.shield, 'function')
  },
  '@rikology/pupitre-audit': (mod) => {
    assert.equal(typeof mod.audit, 'function')
  },
  '@rikology/pupitre-transmit': (mod) => {
    assert.equal(typeof mod.transmitRealtime, 'function')
  },
  '@rikology/pupitre-transmit/client': (mod) => {
    assert.equal(typeof mod.transmitRealtimeClient, 'function')
  },
  '@rikology/create-pupitre-plugin': (mod) => {
    assert.equal(typeof mod.createPlugin, 'function')
  },
}

function runtimeTarget(target) {
  return typeof target === 'string' ? target : target.default
}

/**
 * Expands a wildcard export (`./commands/*`) into concrete files present in
 * the build output.
 */
async function expand(pkgDir, subpath, target) {
  if (!subpath.includes('*')) {
    return [{ subpath, file: target }]
  }
  const [prefix, suffix] = target.split('*')
  const dir = join(pkgDir, prefix)
  let entries = []
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }
  return entries
    .filter((name) => name.endsWith(suffix) && !name.endsWith(`.d${suffix.replace('.js', '.ts')}`))
    .map((name) => {
      const stem = name.slice(0, name.length - suffix.length)
      return { subpath: subpath.replace('*', stem), file: `${prefix}${stem}${suffix}` }
    })
}

let passed = 0
let failed = 0

for (const relative of packages) {
  const pkgDir = join(root, relative)
  const pkg = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf-8'))
  const pack = spawnSync('npm', ['pack', '--dry-run', '--json', '-w', relative], {
    cwd: root,
    encoding: 'utf8',
  })
  const packErrors =
    pack.status === 0
      ? checkPackedFiles(pkg.name, JSON.parse(pack.stdout)[0].files)
      : [`${pkg.name}: npm pack failed: ${pack.stderr}`]
  if (packErrors.length) {
    failed += packErrors.length
    for (const error of packErrors) console.error(`✗ ${error}`)
  } else {
    passed++
    console.log(`✓ ${pkg.name}: tarball hygiene and release assets`)
  }
  const dependencies = await checkDependencies(pkgDir)
  if (dependencies.errors.length) {
    failed += dependencies.errors.length
    for (const error of dependencies.errors) console.error(`✗ ${error}`)
  } else {
    passed++
    console.log(`✓ ${pkg.name}: ${dependencies.files} runtime files use declared dependencies`)
  }
  // Dependencies must stay external: a `build/node_modules` means tsdown inlined an undeclared one.
  if (await stat(join(pkgDir, 'build/node_modules')).catch(() => undefined)) {
    failed++
    console.error(`✗ ${pkg.name}: build/node_modules exists (undeclared dependency was bundled)`)
  }
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    const file = runtimeTarget(target)
    if (!file.endsWith('.js')) {
      continue
    }
    for (const entry of await expand(pkgDir, subpath, file)) {
      const id = `${pkg.name}${entry.subpath === '.' ? '' : entry.subpath.slice(1)}`
      try {
        const mod = await import(pathToFileURL(join(pkgDir, entry.file)).href)
        shapeChecks[id]?.(mod)
        console.log(`✓ ${id}`)
        passed++
      } catch (error) {
        failed++
        console.error(`✗ ${id} -> ${entry.file}: ${error.message}`)
      }
    }
  }
}

/**
 * The catalog must load in a process where every bare import other than zod
 * (and node builtins) is rejected.
 */
const isolation = spawnSync(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    `
    import { registerHooks } from 'node:module'
    registerHooks({
      resolve(specifier, context, next) {
        const bare = !specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('file:') && !specifier.startsWith('node:')
        if (bare && specifier !== 'zod' && !specifier.startsWith('zod/')) {
          throw new Error('catalog imported forbidden module ' + specifier)
        }
        return next(specifier, context)
      },
    })
    const mod = await import(${JSON.stringify(pathToFileURL(join(root, 'packages/pupitre/build/catalog/index.js')).href)})
    if (typeof mod.catalogVersion !== 'string') throw new Error('catalogVersion missing')
    `,
  ],
  { encoding: 'utf-8', cwd: join(root, 'packages/pupitre') }
)
if (isolation.status === 0) {
  console.log('✓ @rikology/pupitre/catalog loads with zod only')
  passed++
} else {
  failed++
  console.error(`✗ catalog isolation: ${isolation.stderr.trim()}`)
}

/**
 * Source imports do not prove bundled dependency ordering. Install the browser
 * CSP trap in a fresh process before importing the built catalog, and count even
 * Function probes whose errors Zod catches internally.
 */
const catalogCsp = spawnSync(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    `
    import assert from 'node:assert/strict'
    globalThis.window = {}
    let probes = 0
    const blocked = () => {
      probes++
      throw new Error('CSP blocks Function')
    }
    globalThis.Function = new Proxy(globalThis.Function, {
      apply: blocked,
      construct: blocked,
    })
    const mod = await import(${JSON.stringify(pathToFileURL(join(root, 'packages/pupitre/build/catalog/index.js')).href)})
    const { z } = await import('zod')
    assert.equal(z.config().jitless, true, 'Browser catalog must configure Zod as jitless')
    mod.actionResult.safeParse({})
    mod.realtimeEvent.parse({ type: 'pupitre:notification' })
    mod.actions.visit.params.parse({ url: '/admin' })
    assert.equal(probes, 0, 'Built catalog must never attempt a CSP Function probe')
    `,
  ],
  { encoding: 'utf-8', cwd: join(root, 'packages/pupitre') }
)
if (catalogCsp.status === 0) {
  console.log('✓ built @rikology/pupitre/catalog initializes and parses without Function probes')
  passed++
} else {
  failed++
  console.error(`✗ built catalog CSP: ${catalogCsp.error?.message ?? catalogCsp.stderr.trim()}`)
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) {
  process.exit(1)
}
