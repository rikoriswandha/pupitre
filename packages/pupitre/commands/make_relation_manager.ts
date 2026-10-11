import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { kebab } from '../src/definition/shared.js'
import { stubsRoot } from '../stubs/main.js'
export function renderRelationManagerDefinition(options: {
  template: string
  parent: string
  modelImport: string
  relation: string
  label: string
}): string {
  return options.template
    .replaceAll('{{parent}}', options.parent)
    .replaceAll('{{modelImport}}', JSON.stringify(options.modelImport))
    .replaceAll('{{relation}}', JSON.stringify(options.relation))
    .replaceAll('{{label}}', JSON.stringify(options.label))
}

export async function writeRelationManagerDefinition(options: {
  target: string
  directory: string
  template: string
  parent: string
  modelImport: string
  relation: string
  label: string
}): Promise<string | null> {
  const output = renderRelationManagerDefinition(options)
  await mkdir(options.directory, { recursive: true })
  try {
    await writeFile(options.target, output, { flag: 'wx' })
    return output
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return null
    throw error
  }
}

export default class MakeRelationManagerCommand extends BaseCommand {
  static commandName = 'make:relation-manager'
  static description = 'Generate a Pupitre relation manager'
  static options = { startApp: true as const }

  @args.string({ description: 'Parent Lucid model name' })
  declare parent: string

  @args.string({ description: 'Relationship name on the parent model' })
  declare relation: string

  @flags.string({ description: 'Parent model module path (defaults to #models/<model>)' })
  declare model: string | undefined

  @flags.boolean({ description: 'Overwrite an existing relation manager' })
  declare force: boolean

  async run() {
    if (
      !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(this.parent) ||
      !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(this.relation)
    ) {
      this.logger.error('Provide valid parent model and relationship identifiers.')
      this.exitCode = 1
      return
    }
    const parent = this.parent
    const relation = this.relation
    const modelImport = this.model ?? `#models/${kebab(parent)}`
    const module = await this.app.import(modelImport)
    if (!module.default || typeof module.default !== 'function') {
      this.logger.error(`The module ${modelImport} must have a default Lucid model export.`)
      this.exitCode = 1
      return
    }
    const directory = this.app.makePath('app/admin/relation_managers')
    const target = this.app.makePath(
      'app/admin/relation_managers',
      `${kebab(relation).replaceAll('-', '_')}_relation_manager.ts`
    )
    const template = await readFile(join(stubsRoot, 'make/relation-manager.stub'), 'utf8')
    const options = {
      template,
      parent,
      modelImport,
      relation,
      label: relation.replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
    }
    if (this.force) {
      await mkdir(directory, { recursive: true })
      await writeFile(target, renderRelationManagerDefinition(options), 'utf8')
      this.logger.success(`Created relation manager: ${target}`)
      return
    }
    const output = await writeRelationManagerDefinition({ ...options, target, directory })
    if (output === null) this.logger.info(`Relation manager already exists: ${target}`)
    else this.logger.success(`Created relation manager: ${target}`)
  }
}
