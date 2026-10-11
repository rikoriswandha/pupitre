import { mkdtemp, mkdir, writeFile, readFile, symlink, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { root } from './index.mjs'

const execute = promisify(execFile)
// The prerelease Pupitre packages are not published yet. Supply their npm dependencies
// from the workspace; keep all file payloads, targets and registry edges unchanged.
const host = await mkdtemp(join(tmpdir(), 'pupitre-shadcn-vite-'))
const server = createServer((request, response) => {
  const payload = registry.get(`public${request.url}`)
  const item = payload && JSON.parse(payload)
  if (item?.dependencies)
    item.dependencies = item.dependencies.map((dependency) =>
      dependency.slice(0, dependency.lastIndexOf('@'))
    )
  if (item?.registryDependencies)
    item.registryDependencies = item.registryDependencies.map(
      (url) => `${origin}/r/${new URL(url).pathname.split('/').at(-1)}`
    )
  const content = item && JSON.stringify(item)
  response.writeHead(content ? 200 : 404, { 'Content-Type': 'application/json' })
  response.end(content ?? '{}')
})
let registry
let origin
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  const publicRoot = join(root, 'packages/pupitre-ui/registry/public')
  const index = JSON.parse(await readFile(join(publicRoot, 'registry.json'), 'utf8'))
  registry = new Map(
    await Promise.all(
      index.items.map(async ({ name }) => [
        `public/r/${name}.json`,
        await readFile(join(publicRoot, 'r', `${name}.json`), 'utf8'),
      ])
    )
  )
  await mkdir(join(host, 'inertia'), { recursive: true })
  await symlink(join(root, 'node_modules'), join(host, 'node_modules'))
  const dependencies = Object.fromEntries(
    [...registry.values()].flatMap((content) =>
      (JSON.parse(content).dependencies ?? []).map((dependency) => {
        const split = dependency.lastIndexOf('@')
        return [dependency.slice(0, split), dependency.slice(split + 1)]
      })
    )
  )
  await writeFile(
    join(host, 'package.json'),
    JSON.stringify({
      name: 'pupitre-registry-host',
      type: 'module',
      dependencies: { ...dependencies, vite: '^8', react: '^19', typescript: '~6.0.0' },
    })
  )
  await writeFile(
    join(host, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        skipLibCheck: true,
        baseUrl: '.',
        ignoreDeprecations: '6.0',
        paths: { '@/*': ['./inertia/*'] },
      },
      include: ['inertia/**/*.ts', 'inertia/**/*.tsx'],
    })
  )
  await writeFile(
    join(host, 'components.json'),
    JSON.stringify({
      $schema: 'https://ui.shadcn.com/schema.json',
      style: 'base-nova',
      rsc: false,
      tsx: true,
      tailwind: { config: '', css: 'inertia/app.css', baseColor: 'neutral', cssVariables: true },
      aliases: {
        components: '@/components',
        ui: '@/components/ui',
        utils: '@/lib/utils',
        lib: '@/lib',
        hooks: '@/hooks',
      },
    })
  )
  await writeFile(join(host, 'inertia/app.css'), '@import "tailwindcss";\n')
  await writeFile(join(host, 'vite.config.ts'), 'export default {}\n')
  const command = [
    '--yes',
    'shadcn@4',
    'add',
    `${origin}/r/select.json`,
    `${origin}/r/use-panel-theme.json`,
    '--yes',
    '--cwd',
    host,
  ]
  console.log('npx', command.join(' '))
  const copied = await execute('npx', command, { maxBuffer: 10 * 1024 * 1024 })
  console.log(copied.stdout, copied.stderr)
  async function tree(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = `${prefix}${entry.name}`
      if (entry.isDirectory()) await tree(join(directory, entry.name), `${path}/`)
      else console.log(path)
    }
  }
  await tree(join(host, 'inertia'), 'inertia/')
  await execute(process.execPath, [
    join(root, 'node_modules/typescript/bin/tsc'),
    '--noEmit',
    '-p',
    join(host, 'tsconfig.json'),
  ])
  console.log('tsc --noEmit: PASS')
} finally {
  server.close()
  await rm(host, { recursive: true, force: true })
}
