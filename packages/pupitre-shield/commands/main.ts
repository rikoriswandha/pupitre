import { readFile } from 'node:fs/promises'
import type { CommandMetaData } from '@adonisjs/core/types/ace'
export async function getMetaData(): Promise<CommandMetaData[]> {
  const manifest = JSON.parse(await readFile(new URL('./commands.json', import.meta.url), 'utf8'))
  return manifest.commands.map(
    ({ filePath: _filePath, ...metadata }: CommandMetaData & { filePath: string }) => metadata
  )
}
export async function getCommand(metadata: CommandMetaData) {
  if (metadata.commandName !== 'shield:sync') return null
  const command = await import('./sync.js')
  return command.default
}
