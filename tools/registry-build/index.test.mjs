import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, access, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { buildRegistry, writeRegistry, checkRegistry, imports, packageName } from './index.mjs'

test('registry is deterministic and stale files fail the check', async () => {
  const first = await buildRegistry()
  assert.deepEqual(first, await buildRegistry())
  const temporary = await mkdtemp(join(tmpdir(), 'pupitre-registry-check-'))
  try {
    await writeRegistry(temporary, first)
    await checkRegistry(temporary, first)
    await writeFile(join(temporary, 'public/r/select.json'), '{}')
    await assert.rejects(checkRegistry(temporary, first), /Run npm run registry:build/)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})

test('every item copies with relative imports intact and declared npm dependencies', async () => {
  const registry = await buildRegistry()
  const items = [...registry.keys()].filter((path) => path.startsWith('public/r/'))
  for (const path of items) {
    const temporary = await mkdtemp(join(tmpdir(), 'pupitre-registry-host-'))
    const visited = new Set()
    const dependencies = new Set()
    const copied = []
    async function copy(itemPath) {
      if (visited.has(itemPath)) return
      visited.add(itemPath)
      const item = JSON.parse(registry.get(itemPath))
      for (const dependency of item.dependencies)
        dependencies.add(dependency.replace(/@[^@]+$/, ''))
      for (const dependency of item.registryDependencies)
        await copy(`public/r/${new URL(dependency).pathname.split('/').at(-1)}`)
      for (const file of item.files) {
        assert.equal(file.type, 'registry:file')
        assert.match(file.target, /^~\/inertia\/components\/pupitre\//)
        assert.match(item.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        // shadcn resolves ~/ targets from --cwd, independently of component aliases.
        const target = join(temporary, file.target.slice(2))
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, file.content)
        copied.push(target)
      }
    }
    try {
      await copy(path)
      for (const file of copied) {
        for (const specifier of imports(await readFile(file, 'utf8'))) {
          if (!specifier.startsWith('.')) {
            assert.ok(dependencies.has(packageName(specifier)), `${path}: undeclared ${specifier}`)
            continue
          }
          const target = resolve(dirname(file), specifier)
          const candidates = [
            target,
            target.replace(/\.js$/, '.ts'),
            target.replace(/\.js$/, '.tsx'),
            `${target}.ts`,
            `${target}.tsx`,
            `${target}/index.tsx`,
          ]
          const exists = await Promise.all(
            candidates.map((candidate) =>
              access(candidate).then(
                () => true,
                () => false
              )
            )
          )
          assert.ok(exists.some(Boolean), `${path}: missing copied import ${specifier}`)
        }
      }
    } finally {
      await rm(temporary, { recursive: true, force: true })
    }
  }
})

test('registry refuses sensitive source paths, symlinks and embedded credentials', async () => {
  for (const file of [
    '.env.ts',
    'components/secrets.ts',
    'private/config.ts',
    'components/.hidden.ts',
  ]) {
    const source = await mkdtemp(join(tmpdir(), 'pupitre-registry-sensitive-'))
    try {
      await mkdir(dirname(join(source, file)), { recursive: true })
      await writeFile(join(source, file), 'export const value = 1')
      await assert.rejects(buildRegistry({ source }), /Sensitive registry source path/)
    } finally {
      await rm(source, { recursive: true, force: true })
    }
  }
  for (const content of [
    'export const apiKey = "a-real-looking-secret-value"',
    'export const key = "-----BEGIN PRIVATE KEY-----"',
    'export const token = "ghp_' + 'a'.repeat(36) + '"',
  ]) {
    const source = await mkdtemp(join(tmpdir(), 'pupitre-registry-secret-'))
    try {
      await mkdir(join(source, 'components'))
      await writeFile(join(source, 'components/demo.ts'), content)
      await assert.rejects(buildRegistry({ source }), /Potential secret/)
    } finally {
      await rm(source, { recursive: true, force: true })
    }
  }
  const source = await mkdtemp(join(tmpdir(), 'pupitre-registry-symlink-'))
  try {
    await symlink(join(source, 'missing'), join(source, 'escaped.ts'))
    await assert.rejects(buildRegistry({ source }), /symlink/)
  } finally {
    await rm(source, { recursive: true, force: true })
  }
})
