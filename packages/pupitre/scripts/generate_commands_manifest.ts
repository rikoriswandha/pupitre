import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { FsLoader } from '@adonisjs/ace'

const builtCommandsDir = join(import.meta.dirname, '../build/commands')
const loader = new FsLoader(builtCommandsDir, (filePath) => filePath !== 'main.js')
const commands = await loader.getMetaData()
const manifest = `${JSON.stringify({ commands, version: 1 }, null, 2)}\n`

await Promise.all([
  writeFile(join(import.meta.dirname, '../commands/commands.json'), manifest),
  writeFile(join(builtCommandsDir, 'commands.json'), manifest),
])
