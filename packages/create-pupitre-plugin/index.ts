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

export interface CreatePluginOptions {
  name: string
  directory: string
  force?: boolean
}

export function pluginNames(input: string) {
  const match =
    /^(?:@([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\/)?(pupitre-)?([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/.exec(
      input
    )
  if (!match)
    throw new Error('Plugin name must be kebab-case, optionally prefixed with pupitre- or @scope/')
  const name = match[3]!
  const camel = name.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase())
  const camelName = Object.hasOwn(reserved, camel) ? `${camel}Plugin` : camel
  return { name, camelName, packageName: `${match[1] ? `@${match[1]}/` : ''}pupitre-${name}` }
}

export async function createPlugin({
  name: input,
  directory,
  force = false,
}: CreatePluginOptions): Promise<string[]> {
  const names = pluginNames(input)
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
  const written: string[] = []
  async function copy(relative = ''): Promise<void> {
    for (const entry of await readdir(join(source, relative), { withFileTypes: true })) {
      const path = join(relative, entry.name)
      await rejectSymlink(join(target, path === 'gitignore.stub' ? '.gitignore' : path))
      if (entry.isDirectory()) {
        await mkdir(join(target, path), { recursive: true })
        await copy(path)
      } else if (entry.isFile()) {
        let content = await readFile(join(source, path), 'utf8')
        for (const [token, value] of Object.entries(names))
          content = content.replaceAll(`{{${token}}}`, value).replaceAll(`__${token}__`, value)
        // npm excludes .gitignore from tarballs; ship it under a template-only name.
        const output = join(target, path === 'gitignore.stub' ? '.gitignore' : path)
        await writeFile(output, content, { flag: force ? 'w' : 'wx' })
        written.push(output)
      }
    }
  }
  await copy()
  return written
}
