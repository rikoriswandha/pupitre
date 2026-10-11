import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stubsRoot } from '../stubs/main.js'

export async function writePanelDefinition(options: {
  target: string
  directory: string
  template: string
  name: string
  path: string
  guard: string
}): Promise<string | null> {
  const output = options.template
    .replaceAll('{{panel}}', options.name)
    .replaceAll('{{path}}', options.path)
    .replaceAll('{{guard}}', options.guard)
  await mkdir(options.directory, { recursive: true })
  try {
    await writeFile(options.target, output, { flag: 'wx' })
    return output
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return null
    throw error
  }
}

export default class MakePanelCommand extends BaseCommand {
  static commandName = 'make:panel'
  static description = 'Create a Pupitre panel definition'

  @args.string({ description: 'Panel identifier' })
  declare name: string

  @flags.string({ description: 'URL prefix (defaults to /<name>)' })
  declare path?: string

  @flags.string({ description: 'Authentication guard', default: 'web' })
  declare guard: string

  async run() {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(this.name)) {
      this.logger.error(`Invalid panel identifier "${this.name}"`)
      this.exitCode = 1
      return
    }
    const directory = this.app.makePath('app/admin/panels')
    const target = this.app.makePath('app/admin/panels', `${this.name}.ts`)
    const template = await readFile(join(stubsRoot, 'app/admin/panels/panel.stub'), 'utf8')
    const output = await writePanelDefinition({
      target,
      directory,
      template,
      name: this.name,
      path: this.path ?? `/${this.name}`,
      guard: this.guard,
    })
    if (output === null) this.logger.info(`Panel already exists: ${target}`)
    else this.logger.success(`Created Pupitre panel: ${target}`)
  }
}
