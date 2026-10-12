import { mkdir, readdir, readFile, writeFile, lstat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const reserved: Record<string, true> = {
  await: true,
  break: true,
  case: true,
  catch: true,
  class: true,
  const: true,
  continue: true,
  debugger: true,
  default: true,
  delete: true,
  do: true,
  else: true,
  enum: true,
  export: true,
  extends: true,
  false: true,
  finally: true,
  for: true,
  function: true,
  if: true,
  implements: true,
  import: true,
  in: true,
  instanceof: true,
  interface: true,
  let: true,
  new: true,
  null: true,
  package: true,
  private: true,
  protected: true,
  public: true,
  return: true,
  static: true,
  super: true,
  switch: true,
  this: true,
  throw: true,
  true: true,
  try: true,
  typeof: true,
  var: true,
  void: true,
  while: true,
  with: true,
  yield: true,
  eval: true,
  arguments: true,
}
// These bindings belong to the UI template's server entry, not its plugin factory.
const uiReserved: Record<string, true> = {
  defineField: true,
  definePlugin: true,
  vine: true,
}

export interface CreatePluginOptions {
  name: string
  directory: string
  force?: boolean
  withUi?: boolean
}

export function pluginNames(input: string, withUi = false) {
  const match =
    /^(?:@([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\/)?(pupitre-)?([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/.exec(
      input
    )
  if (!match)
    throw new Error('Plugin name must be kebab-case, optionally prefixed with pupitre- or @scope/')
  const name = match[3]!
  const camel = name.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase())
  let camelName = Object.hasOwn(reserved, camel) ? `${camel}Plugin` : camel
  if (withUi && Object.hasOwn(uiReserved, camelName)) camelName += 'Plugin'
  const fieldName = `${camel}Field`
  return {
    name,
    camelName,
    fieldName: withUi && Object.hasOwn(uiReserved, fieldName) ? `${camel}PluginField` : fieldName,
    catalogName: `${camel}Catalog`,
    componentName: `${camel[0]!.toUpperCase()}${camel.slice(1)}Input`,
    packageName: `${match[1] ? `@${match[1]}/` : ''}pupitre-${name}`,
  }
}

export async function createPlugin({
  name: input,
  directory,
  force = false,
  withUi = false,
}: CreatePluginOptions): Promise<string[]> {
  const names = pluginNames(input, withUi)
  if (!directory || directory.split(/[\\/]/).includes('..'))
    throw new Error('Target directory must not contain parent traversal')
  const target = resolve(directory)
  // --force must never follow an existing symlink outside the chosen destination.
  async function rejectSymlink(path: string): Promise<void> {
    const stat = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined
      throw error
    })
    if (stat?.isSymbolicLink()) throw new Error(`Target path is a symlink: ${path}`)
  }
  await rejectSymlink(target)
  await mkdir(target, { recursive: true })
  const existing = !force && (await readdir(target))
  if (existing && existing.length) {
    throw new Error(
      `Target directory is not empty: ${target} (use --force to overwrite template files)`
    )
  }
  const source = fileURLToPath(
    new URL(import.meta.url.endsWith('.ts') ? './template/' : '../template/', import.meta.url)
  )
  const templates = new Map<string, string>()
  async function collect(root: string, relative = ''): Promise<void> {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      const path = join(relative, entry.name)
      if (entry.isDirectory()) await collect(root, path)
      else if (entry.isFile()) templates.set(path, join(root, path))
    }
  }
  await collect(source)
  if (withUi) await collect(join(source, '../template-ui'))

  const written: string[] = []
  for (const [path, template] of templates) {
    const parts = path.split(/[\\/]/)
    let parent = target
    for (const part of parts.slice(0, -1)) {
      parent = join(parent, part)
      await rejectSymlink(parent)
      await mkdir(parent, { recursive: true })
    }
    let content = await readFile(template, 'utf8')
    for (const [token, value] of Object.entries(names))
      content = content
        .replaceAll(`{{${token}}}`, value)
        .replaceAll(`__${token}__`, value)
        .replaceAll(`${token}Placeholder`, value)
    // npm excludes .gitignore from tarballs; ship it under a template-only name.
    const output = join(target, path === 'gitignore.stub' ? '.gitignore' : path)
    await rejectSymlink(output)
    await writeFile(output, content, { flag: force ? 'w' : 'wx' })
    written.push(output)
  }
  return written
}
