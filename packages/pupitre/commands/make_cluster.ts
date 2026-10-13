import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { kebab } from '../src/definition/shared.js'
import { stubsRoot } from '../stubs/main.js'

export async function writeClusterDefinition(options: {
  target: string
  directory: string
  template: string
  slug: string
  label: string
  force?: boolean
}): Promise<string | null> {
  const output = options.template
    .replaceAll('{{slug}}', options.slug)
    .replaceAll('{{label}}', JSON.stringify(options.label))
  await mkdir(options.directory, { recursive: true })
  try {
    await writeFile(options.target, output, { flag: options.force ? 'w' : 'wx' })
    return output
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return null
    throw error
  }
}

export default class MakeClusterCommand extends BaseCommand {
  static commandName = 'make:cluster'
  static description = 'Generate a Pupitre navigation cluster'
  @args.string({ description: 'Cluster name' })
  declare name: string
  @flags.boolean({ description: 'Overwrite an existing cluster file' })
  declare force: boolean
  async run() {
    const label = this.name.replace(/Cluster$/, '')
    const slug = kebab(label)
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug)) {
      this.logger.error(`Invalid cluster name "${this.name}"`)
      this.exitCode = 1
      return
    }
    const directory = this.app.makePath('app/admin/clusters')
    const target = join(directory, `${slug.replaceAll('-', '_')}_cluster.ts`)
    const output = await writeClusterDefinition({
      directory,
      target,
      template: await readFile(join(stubsRoot, 'make/cluster.stub'), 'utf8'),
      slug,
      label,
      force: this.force,
    })
    if (output === null) this.logger.info(`Cluster already exists: ${target}`)
    else this.logger.success(`Created cluster: ${target}`)
  }
}
