import { access, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type Configure from '@adonisjs/core/commands/configure'

const STUBS_ROOT = join(import.meta.dirname, 'stubs')

async function exists(path: string | URL) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Configure a host app with the Pupitre provider, generated admin registry,
 * preload and starter files. Existing files are intentionally preserved.
 */
type ConfigureCommand = Pick<Configure, 'app' | 'parsedFlags' | 'createCodemods'>

export async function configure(command: ConfigureCommand) {
  const codemods = await command.createCodemods()
  const flags = command.parsedFlags
  const panel = String(flags.panel ?? 'admin')
  const path = String(flags.path ?? '/admin')
  const auth = String(flags.auth ?? 'web')
  const stubs = [
    ['config/pupitre.stub', 'config/pupitre.ts', { path }],
    ['start/pupitre.stub', 'start/pupitre.ts', {}],
    ['app/admin/panels/admin.stub', 'app/admin/panels/admin.ts', { panel, path, auth }],
    ['inertia/pages/pupitre.stub', 'inertia/pages/pupitre.tsx', {}],
    ['inertia/admin/registry.stub', 'inertia/admin/registry.ts', {}],
  ] as const

  await codemods.installPackages([
    { name: '@rikology/pupitre-react', isDevDependency: false },
    { name: '@rikology/pupitre-ui', isDevDependency: false },
    { name: 'tailwindcss', isDevDependency: true },
    { name: '@tailwindcss/vite', isDevDependency: true },
  ])
  await codemods.registerVitePlugin('tailwindcss()', [
    { isNamed: false, module: '@tailwindcss/vite', identifier: 'tailwindcss' },
  ])

  const cssPath = command.app.makePath('inertia/css/app.css')
  if (await exists(cssPath)) {
    const css = await readFile(cssPath, 'utf-8')
    const cssImport = "@import '@rikology/pupitre-ui/styles.css';"
    if (!css.includes(cssImport)) await writeFile(cssPath, `${css.trimEnd()}\n${cssImport}\n`)
  }

  for (const [stub, destination, data] of stubs) {
    if (await exists(command.app.makePath(destination))) continue
    await codemods.makeUsingStub(STUBS_ROOT, stub, data)
  }

  const rcFilePath = command.app.makePath('adonisrc.ts')
  const rcSource = await readFile(rcFilePath, 'utf-8')
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@rikology/pupitre/pupitre_provider')
    rcFile.addCommand('@rikology/pupitre/commands')
    rcFile.addPreloadFile('#start/pupitre')
    const hasIndexAdminImport =
      /import\s*\{[^}]*\bindexAdmin\b[^}]*\}\s*from\s*['"]@rikology\/pupitre\/hooks['"]/s.test(
        rcSource
      )
    if (!hasIndexAdminImport) rcFile.addNamedImport('@rikology/pupitre/hooks', ['indexAdmin'])
    // The raw hook API does not deduplicate entries.
    if (!rcSource.includes('indexAdmin()')) rcFile.addAssemblerHook('init', 'indexAdmin()', true)
  })

  const packageJsonPath = command.app.makePath('package.json')
  if (await exists(packageJsonPath)) {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as {
      imports?: Record<string, unknown>
    }
    packageJson.imports ??= {}
    if (packageJson.imports['#admin/*'] !== './app/admin/*.js') {
      packageJson.imports['#admin/*'] = './app/admin/*.js'
      await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
    }
  }
}
