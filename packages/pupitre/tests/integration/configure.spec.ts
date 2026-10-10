import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from '@japa/runner'
import Configure from '@adonisjs/core/commands/configure'
import { AppFactory } from '@adonisjs/core/factories/app'
import { configure } from '../../configure.js'

const hostFiles = [
  'config/pupitre.ts',
  'start/pupitre.ts',
  'app/admin/panels/admin.ts',
  'inertia/pages/pupitre.tsx',
  'inertia/admin/registry.ts',
]

test.group('Pupitre configure', () => {
  test('creates host wiring and is idempotent with real codemods', async ({ assert }) => {
    const fixturesRoot = join(import.meta.dirname, '../../tmp')
    await mkdir(fixturesRoot, { recursive: true })
    const root = await mkdtemp(join(fixturesRoot, 'configure-'))
    const rootUrl = pathToFileURL(`${root}/`)
    const app = new AppFactory().create(rootUrl, (id) => import(id))
    try {
      await Promise.all([
        mkdir(join(root, 'config'), { recursive: true }),
        mkdir(join(root, 'start'), { recursive: true }),
      ])
      await writeFile(
        join(root, 'package.json'),
        JSON.stringify(
          {
            name: 'pupitre-configure-fixture',
            type: 'module',
            imports: { '#start/*': './start/*.js' },
          },
          null,
          2
        )
      )
      await writeFile(
        join(root, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext' } })
      )
      await writeFile(
        join(root, 'adonisrc.ts'),
        `import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  providers: [],
  commands: [],
  preloads: [],
  hooks: { init: [] },
})
`
      )
      await writeFile(
        join(root, 'start/kernel.ts'),
        `import router from '@adonisjs/core/services/router'\n\nexport { router }\n`
      )
      await app.init()

      type CommandArgs = ConstructorParameters<typeof Configure>
      const parsed = {
        _: [],
        flags: { panel: 'admin', path: '/admin', auth: 'web' },
        args: [],
        nodeArgs: [],
        unknownFlags: [],
      } as CommandArgs[2]
      const cliLogger = {
        action: () => ({ succeeded() {}, skipped() {}, failed() {} }),
        warning() {},
      }
      const command = new Configure(
        app as unknown as CommandArgs[0],
        {} as CommandArgs[1],
        parsed,
        { logger: cliLogger } as unknown as CommandArgs[3],
        {} as CommandArgs[4]
      )

      await configure(command)
      const watchedFiles = [
        'adonisrc.ts',
        'package.json',
        'tsconfig.json',
        'start/kernel.ts',
        ...hostFiles,
      ]
      const first = await Promise.all(
        watchedFiles.map(async (path) => [path, await readFile(join(root, path), 'utf-8')] as const)
      )
      const rcFile = first.find(([path]) => path === 'adonisrc.ts')![1]
      assert.equal((rcFile.match(/@rikology\/pupitre\/pupitre_provider/g) ?? []).length, 1)
      assert.equal((rcFile.match(/@rikology\/pupitre\/commands/g) ?? []).length, 1)
      assert.equal((rcFile.match(/#start\/pupitre/g) ?? []).length, 1)
      assert.equal((rcFile.match(/indexAdmin\(\)/g) ?? []).length, 1)
      assert.equal((rcFile.match(/@rikology\/pupitre\/hooks/g) ?? []).length, 1)
      const packageJson = JSON.parse(first.find(([path]) => path === 'package.json')![1])
      assert.equal(packageJson.imports['#admin/*'], './app/admin/*.js')

      await configure(command)
      const second = await Promise.all(
        watchedFiles.map(async (path) => [path, await readFile(join(root, path), 'utf-8')] as const)
      )
      assert.deepEqual(second, first)
    } finally {
      await app.terminate()
      await rm(root, { recursive: true, force: true })
    }
  })
})
