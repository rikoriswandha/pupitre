import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { kebab } from '../src/definition/shared.js'
import { stubsRoot } from '../stubs/main.js'

export async function writePageDefinition(options: {
  target: string
  directory: string
  template: string
  slug: string
  title: string
}): Promise<string | null> {
  const output = options.template
    .replaceAll('{{slug}}', options.slug)
    .replaceAll('{{title}}', JSON.stringify(options.title))
  await mkdir(options.directory, { recursive: true })
  try {
    await writeFile(options.target, output, { flag: 'wx' })
    return output
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return null
    throw error
  }
}

export default class MakePageCommand extends BaseCommand {
  static commandName = 'make:page'
  static description = 'Generate a Pupitre custom page'

  @args.string({ description: 'Custom page name' })
  declare name: string

  @flags.boolean({ description: 'Overwrite an existing page file' })
  declare force: boolean

  async run() {
    const slug = kebab(this.name.replace(/Page$/, ''))
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug)) {
      this.logger.error(`Invalid page name "${this.name}"`)
      this.exitCode = 1
      return
    }
    const directory = this.app.makePath('app/admin/pages')
    const target = this.app.makePath('app/admin/pages', `${slug.replaceAll('-', '_')}_page.ts`)
    const template = await readFile(join(stubsRoot, 'make/page.stub'), 'utf8')
    if (this.force) {
      const output = template
        .replaceAll('{{slug}}', slug)
        .replaceAll('{{title}}', JSON.stringify(this.name))
      await mkdir(directory, { recursive: true })
      await writeFile(target, output, 'utf8')
      this.logger.success(`Created page: ${target}`)
      return
    }
    const output = await writePageDefinition({
      target,
      directory,
      template,
      slug,
      title: this.name,
    })
    if (output === null) this.logger.info(`Page already exists: ${target}`)
    else this.logger.success(`Created page: ${target}`)
  }
}
