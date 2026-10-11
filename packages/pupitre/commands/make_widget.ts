import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { kebab } from '../src/definition/shared.js'
import { stubsRoot } from '../stubs/main.js'
const bodies: Record<string, string> = {
  stats: '.stats(() => [])',
  chart: ".chart('line', () => ({ labels: [], datasets: [] }))",
  table: '.table((table) => table)',
}

export function renderWidgetDefinition(
  template: string,
  name: string,
  type: string,
  modelImport = '#models/{{model}}'
): string {
  const modelName = name.replace(/Widget$/, '')
  const slug = kebab(modelName)
  const importLine =
    type === 'table'
      ? `import Model from ${JSON.stringify(modelImport.replaceAll('{{model}}', kebab(modelName)))}`
      : ''
  return template
    .replaceAll('{{modelImport}}', importLine)
    .replaceAll(
      '{{definition}}',
      `defineWidget('${slug}'${type === 'table' ? ', Model' : ''})\n  ${bodies[type]!}`
    )
}

export async function writeWidgetDefinition(options: {
  target: string
  directory: string
  template: string
  name: string
  type: string
  modelImport?: string
}): Promise<string | null> {
  const output = renderWidgetDefinition(
    options.template,
    options.name,
    options.type,
    options.modelImport
  )
  await mkdir(options.directory, { recursive: true })
  try {
    await writeFile(options.target, output, { flag: 'wx' })
    return output
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return null
    throw error
  }
}

export default class MakeWidgetCommand extends BaseCommand {
  static commandName = 'make:widget'
  static description = 'Generate a Pupitre dashboard widget'

  @args.string({ description: 'Widget name' })
  declare name: string

  @flags.string({ description: 'Widget type: stats, chart, or table', default: 'stats' })
  declare type: string

  @flags.string({ description: 'Model module path for table widgets (defaults to #models/<name>)' })
  declare model: string | undefined

  @flags.boolean({ description: 'Overwrite an existing widget file' })
  declare force: boolean

  async run() {
    if (!['stats', 'chart', 'table'].includes(this.type)) {
      this.logger.error(`Invalid widget type "${this.type}"; expected stats, chart, or table`)
      this.exitCode = 1
      return
    }
    const slug = kebab(this.name.replace(/Widget$/, ''))
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug)) {
      this.logger.error(`Invalid widget name "${this.name}"`)
      this.exitCode = 1
      return
    }
    const directory = this.app.makePath('app/admin/widgets')
    const target = this.app.makePath('app/admin/widgets', `${slug.replaceAll('-', '_')}_widget.ts`)
    const template = await readFile(join(stubsRoot, 'make/widget.stub'), 'utf8')
    const modelImport = this.model ?? '#models/{{model}}'
    if (this.force) {
      await mkdir(directory, { recursive: true })
      await writeFile(
        target,
        renderWidgetDefinition(template, this.name, this.type, modelImport),
        'utf8'
      )
      this.logger.success(`Created widget: ${target}`)
      return
    }
    const output = await writeWidgetDefinition({
      target,
      directory,
      template,
      name: this.name,
      type: this.type,
      modelImport,
    })
    if (output === null) this.logger.info(`Widget already exists: ${target}`)
    else this.logger.success(`Created widget: ${target}`)
  }
}
