import { readFile } from 'node:fs/promises'
import type { CommandMetaData } from '@adonisjs/core/types/ace'

let manifest: { commands: (CommandMetaData & { filePath: string })[] } | undefined

async function loadManifest() {
  if (!manifest) {
    manifest = JSON.parse(await readFile(new URL('./commands.json', import.meta.url), 'utf-8'))
  }
  return manifest!
}

/**
 * Lazy command loader consumed by Ace through `rcFile.commands`.
 */
export async function getMetaData(): Promise<CommandMetaData[]> {
  const { commands } = await loadManifest()
  return commands.map(({ filePath: _filePath, ...metaData }) => metaData)
}

export async function getCommand(metaData: CommandMetaData) {
  const { commands } = await loadManifest()
  const command = commands.find(({ commandName }) => metaData.commandName === commandName)
  if (!command) {
    return null
  }
  const commandPath = import.meta.url.endsWith('/main.ts')
    ? command.filePath.replace(/\.js$/, '.ts')
    : command.filePath
  const { default: commandConstructor } = await import(new URL(commandPath, import.meta.url).href)
  return commandConstructor
}
