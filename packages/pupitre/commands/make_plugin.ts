import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { kebab } from '../src/definition/shared.js'
import { stubsRoot } from '../stubs/main.js'

export async function writePluginDefinition(options: {
  target: string
  directory: string
  template: string
  slug: string
  force?: boolean
}): Promise<string | null> {
  const output = options.template.replaceAll('{{slug}}', options.slug)
  await mkdir(options.directory, { recursive: true })
  try {
    await writeFile(options.target, output, { flag: options.force ? 'w' : 'wx' })
    return output
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return null
    throw error
  }
}

export async function scaffoldPluginPackage(name: string, directory = name, services = { spawn }) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name))
    throw new Error(`Invalid plugin name "${name}"`)
  const manifest = await readFile(new URL('../package.json', import.meta.url), 'utf8').catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
      return readFile(new URL('../../package.json', import.meta.url), 'utf8')
    }
  )
  const major = String(JSON.parse(manifest).version).split('.')[0]
  const installerArgs = [
    '--yes',
    `@rikology/create-pupitre-plugin@${major}`,
    name,
    '--dir',
    directory,
  ]
  await new Promise<void>((resolve, reject) => {
    const child = services.spawn('npx', installerArgs, { stdio: 'inherit', shell: false })
    child.once('error', reject)
    child.once('close', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`Plugin scaffolder exited ${signal ?? `with code ${code}`}`))
    })
  })
  return installerArgs
}

export default class MakePluginCommand extends BaseCommand {
  static commandName = 'make:plugin'
  static description = 'Generate a local Pupitre plugin or standalone package'

  @args.string({ description: 'Plugin name' })
  declare name: string

  @flags.boolean({ description: 'Overwrite an existing plugin file' })
  declare force: boolean

  @flags.boolean({ description: 'Scaffold a standalone plugin package' })
  declare package: boolean

  @flags.string({ description: 'Destination directory for --package' })
  declare dir: string | undefined

  async run() {
    const slug = kebab(this.name.replace(/Plugin$/, '')).replace(/^pupitre-/, '')
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug)) {
      this.logger.error(`Invalid plugin name "${this.name}"`)
      this.exitCode = 1
      return
    }
    if (this.package) {
      try {
        await scaffoldPluginPackage(slug, this.dir)
      } catch (error) {
        this.logger.error(error instanceof Error ? error.message : String(error))
        this.exitCode = 1
      }
      return
    }
    const directory = this.app.makePath('app/admin/plugins')
    const target = join(directory, `${slug.replaceAll('-', '_')}_plugin.ts`)
    const template = await readFile(join(stubsRoot, 'make/plugin.stub'), 'utf8')
    const output = await writePluginDefinition({
      target,
      directory,
      template,
      slug,
      force: this.force,
    })
    if (output === null) this.logger.info(`Plugin already exists: ${target}`)
    else this.logger.success(`Created plugin: ${target}`)
    this.logger.info(
      `Next: import the plugin from '#admin/plugins/${slug.replaceAll('-', '_')}_plugin' and add it to .plugins([...]).`
    )
  }
}
