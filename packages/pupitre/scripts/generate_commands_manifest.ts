import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { FsLoader } from '@adonisjs/ace'

const source = process.argv.includes('--source')
const builtCommandsDir = join(import.meta.dirname, '../build/commands')
const commandsDir = source ? join(import.meta.dirname, '../commands') : builtCommandsDir
const loader = new FsLoader(commandsDir, (filePath) => !/^main\.(js|ts)$/.test(filePath))
const metadata = await loader.getMetaData()
const commands = metadata.map((command) => ({
  ...command,
  filePath: command.filePath.replace(/\.ts$/, '.js'),
}))
const manifest = `${JSON.stringify({ commands, version: 1 }, null, 2)}\n`

await writeFile(join(import.meta.dirname, '../commands/commands.json'), manifest)
if (!source) await writeFile(join(builtCommandsDir, 'commands.json'), manifest)
