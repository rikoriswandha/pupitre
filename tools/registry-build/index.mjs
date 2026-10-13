import { readFile, readdir, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { dirname, resolve, relative, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export function imports(content) {
  return [
    ...content.matchAll(
      /(?:^\s*(?:import|export)\s+(?:[^;'"]*?\sfrom\s*)?|\bimport\s*\(\s*)(['"])([^'"\n]+)\1/gm
    ),
  ].map((match) => match[2])
}
export function packageName(specifier) {
  return specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0]
}
const sorted = (values) => [...new Set(values)].sort()
const sensitivePath =
  /(?:^|\/)(?:\.[^/]+|node_modules|tests?|__tests__|fixtures?|secrets?|credentials?|private)(?:\/|$)|\.(?:pem|key|p12|pfx)$/i
const secretContent =
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b|(?:api[_-]?key|client[_-]?secret|password|access[_-]?token)\s*[:=]\s*['"][^'"\s]{12,}['"]/i
const json = (value) => `${JSON.stringify(value, null, 2)}\n`
const itemName = (file) =>
  file
    .replace(/\.(tsx?|css)$/, '')
    .replace(/^components\//, '')
    .replaceAll('/', '-')
    .replaceAll('_', '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()

export async function buildRegistry({
  source = join(root, 'packages/pupitre-ui/src'),
  base = 'https://pupitre.rikology.com/r',
} = {}) {
  base = base.replace(/\/$/, '')
  const pkg = JSON.parse(await readFile(join(root, 'packages/pupitre-ui/package.json'), 'utf8'))
  const versions = { ...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.dependencies }
  async function scan(directory, prefix = '') {
    const result = []
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = `${prefix}${entry.name}`
      if (sensitivePath.test(name)) throw new Error(`Sensitive registry source path: ${name}`)
      if (/(?:^|\/)(?:.*[._-])?(?:secrets?|credentials?)(?:[._-].*)?\.(?:tsx?|css)$/i.test(name))
        throw new Error(`Sensitive registry source path: ${name}`)
      if (entry.isSymbolicLink()) throw new Error(`Registry source symlink: ${name}`)
      if (entry.isDirectory()) result.push(...(await scan(join(directory, entry.name), `${name}/`)))
      else if (entry.isFile() && /\.(tsx?|css)$/.test(name)) result.push(name)
    }
    return result.sort()
  }
  const files = (await scan(source)).filter(
    (file) =>
      file.includes('/') ||
      file === 'icons.tsx' ||
      file === 'styles.css' ||
      /^use_.*\.ts$/.test(file)
  )
  const groups = new Map()
  const owner = new Map()
  for (const file of files) {
    const name = file.startsWith('primitives/') ? 'primitives' : itemName(file)
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(file)
    owner.set(file, name)
  }
  const built = []
  for (const [name, paths] of [...groups].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    const registryDependencies = new Set()
    const dependencies = new Set()
    const type =
      name === 'styles'
        ? 'registry:style'
        : name === 'primitives'
          ? 'registry:ui'
          : paths[0].split('/').at(-1).startsWith('use_')
            ? 'registry:hook'
            : paths[0].startsWith('components/')
              ? 'registry:component'
              : 'registry:lib'
    const payload = []
    for (const file of paths) {
      const content = await readFile(join(source, file), 'utf8')
      if (secretContent.test(content))
        throw new Error(`Potential secret in registry source: ${file}`)
      for (const specifier of imports(content)) {
        if (specifier.startsWith('.')) {
          const path = relative(source, resolve(source, dirname(file), specifier))
          const candidates = [
            path,
            path.replace(/\.js$/, '.ts'),
            path.replace(/\.js$/, '.tsx'),
            `${path}.ts`,
            `${path}.tsx`,
            `${path}/index.tsx`,
          ]
          const target = candidates.find((candidate) => owner.has(candidate))
          if (!target) throw new Error(`Unresolved registry import ${specifier} in ${file}`)
          if (owner.get(target) !== name)
            registryDependencies.add(`${base}/${owner.get(target)}.json`)
        } else {
          const dependency = packageName(specifier)
          if (!versions[dependency])
            throw new Error(`Missing dependency version for ${dependency} in ${file}`)
          dependencies.add(`${dependency}@${versions[dependency]}`)
        }
      }
      payload.push({
        path: `../src/${file}`,
        type: 'registry:file',
        target: `~/inertia/components/pupitre/${file}`,
        content,
      })
    }
    built.push({
      $schema: 'https://ui.shadcn.com/schema/registry-item.json',
      name,
      type,
      title:
        name === 'primitives'
          ? 'Pupitre primitives'
          : paths[0]
              .split('/')
              .at(-1)
              .replace(/\.(tsx?|css)$/, ''),
      dependencies: sorted(dependencies),
      registryDependencies: sorted(registryDependencies),
      files: payload,
    })
  }
  const manifest = {
    $schema: 'https://ui.shadcn.com/schema/registry.json',
    name: 'pupitre',
    homepage: 'https://pupitre.rikology.com',
    items: built.map(({ $schema, ...item }) => ({
      ...item,
      files: item.files.map(({ content, ...file }) => file),
    })),
  }
  return new Map([
    ['registry.json', json(manifest)],
    ['public/registry.json', json(manifest)],
    ...built.map((item) => [`public/r/${item.name}.json`, json(item)]),
  ])
}

export async function writeRegistry(output, files) {
  for (const [file, content] of files) {
    await mkdir(dirname(join(output, file)), { recursive: true })
    await writeFile(join(output, file), content)
  }
}
async function allFiles(directory, prefix = '') {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return []
    throw error
  })) {
    const path = `${prefix}${entry.name}`
    if (entry.isDirectory())
      files.push(...(await allFiles(join(directory, entry.name), `${path}/`)))
    else files.push(path)
  }
  return files.sort()
}
export async function checkRegistry(output, files) {
  const temporary = await mkdtemp(join(tmpdir(), 'pupitre-registry-'))
  try {
    await writeRegistry(temporary, files)
    const changed = []
    for (const file of sorted([...(await allFiles(output)), ...files.keys()])) {
      const actual = await readFile(join(output, file), 'utf8').catch(() => undefined)
      if (actual !== files.get(file)) changed.push(file)
    }
    if (changed.length)
      throw new Error(
        `Registry is stale: ${changed.join(', ')}. Run npm run registry:build and commit the generated files.`
      )
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const argv = process.argv.slice(2)
    const base = argv.includes('--base-url')
      ? argv[argv.indexOf('--base-url') + 1]
      : process.env.PUPITRE_REGISTRY_URL
    const output = argv.includes('--output')
      ? resolve(argv[argv.indexOf('--output') + 1])
      : join(root, 'packages/pupitre-ui/registry')
    const files = await buildRegistry({ base })
    if (argv.includes('--check')) await checkRegistry(output, files)
    else {
      const obsolete = (await allFiles(output)).filter((file) => !files.has(file))
      for (const file of obsolete) await rm(join(output, file))
      await writeRegistry(output, files)
    }
    console.log(
      `Registry ${argv.includes('--check') ? 'checked' : 'built'} (${files.size - 2} items)`
    )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
