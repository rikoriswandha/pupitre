import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'

export const SHADCN_VERSION = '4'
export const DEFAULT_REGISTRY = 'https://pupitre.rikology.com'
type InstallerOptions = { registry?: string; yes?: boolean; dryRun?: boolean }
type InstallerServices = { spawn: typeof spawn; fetch: typeof fetch }

export async function addUiComponents(
  names: string[],
  options: InstallerOptions = {},
  services: InstallerServices = { spawn, fetch }
) {
  if (!names.length) throw new Error('Specify at least one component name')
  for (const name of names) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))
      throw new Error(`Unknown Pupitre component "${name}"`)
  }
  const base = new URL(`${(options.registry ?? DEFAULT_REGISTRY).replace(/\/$/, '')}/`)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
  if (
    !['https:', 'http:', 'file:'].includes(base.protocol) ||
    (base.protocol === 'http:' && !loopback) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (base.protocol === 'file:' && base.hostname !== '')
  )
    throw new Error(
      'Registry must use HTTPS, loopback HTTP, or a local file URL without credentials, query, or fragment'
    )
  const indexUrl = new URL('registry.json', base)
  let index: unknown
  if (indexUrl.protocol === 'file:') index = JSON.parse(await readFile(indexUrl, 'utf8'))
  else {
    const response = await services.fetch(indexUrl)
    if (!response.ok) throw new Error(`Cannot load registry index: HTTP ${response.status}`)
    index = await response.json()
  }
  if (!index || typeof index !== 'object' || !('items' in index) || !Array.isArray(index.items)) {
    throw new Error('Registry index must contain an items array')
  }
  const available = new Set(
    index.items.map((item) => item?.name).filter((name) => typeof name === 'string')
  )
  for (const name of names) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || !available.has(name)) {
      throw new Error(
        `Unknown Pupitre component "${name}". Available: ${[...available].sort().join(', ')}`
      )
    }
  }
  const urls = [...new Set(names)].map((name) => {
    const url = new URL(`r/${name}.json`, base)
    return url.protocol === 'file:' ? decodeURIComponent(url.pathname) : url.href
  })
  const installerArgs = [`shadcn@${SHADCN_VERSION}`, 'add', ...urls]
  if (options.yes) installerArgs.push('--yes')
  if (options.dryRun) return installerArgs
  await new Promise<void>((resolve, reject) => {
    const child = services.spawn('npx', installerArgs, { stdio: 'inherit', shell: false })
    child.once('error', reject)
    child.once('close', (code, signal) => {
      if (code === 0) resolve()
      else
        reject(new Error(`shadcn exited ${signal ? `with signal ${signal}` : `with code ${code}`}`))
    })
  })
  return installerArgs
}

export default class UiAddCommand extends BaseCommand {
  static commandName = 'pupitre:ui'
  static description = 'Copy Pupitre components using shadcn: pupitre:ui add <names...>'

  @args.string({ description: 'Operation (add)' })
  declare operation: string

  @args.spread({ description: 'Registry component names (for example select)' })
  declare names: string[]

  @flags.string({ description: 'Registry origin containing registry.json and r/*.json' })
  declare registry: string | undefined

  @flags.boolean({ description: 'Skip shadcn confirmation prompts' })
  declare yes: boolean

  @flags.boolean({
    description: 'Validate names and print the installer command without copying files',
  })
  declare dryRun: boolean

  async run() {
    try {
      if (this.operation !== 'add') throw new Error('Usage: node ace pupitre:ui add <names...>')
      const installerArgs = await addUiComponents(this.names, this)
      if (this.dryRun) this.logger.info(`npx ${installerArgs.join(' ')}`)
      this.logger.info(
        'Activate it in inertia/admin/registry.ts: defineRegistry({ ...components, Select: MySelect })'
      )
      this.logger.info(
        'Import components/pupitre/styles.css in your Tailwind CSS entry when using copied styles.'
      )
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error))
      this.exitCode = 1
    }
  }
}
