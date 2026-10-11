import { access } from 'node:fs/promises'
import { join } from 'node:path'
import type Configure from '@adonisjs/core/commands/configure'
export async function configure(
  command: Pick<Configure, 'app' | 'parsedFlags' | 'createCodemods'>
) {
  const codemods = await command.createCodemods()
  const userTable = String(command.parsedFlags['user-table'] ?? 'users')
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(userTable)) throw new Error('Invalid Shield user table')
  const destination = command.app.makePath(
    'database/migrations/1791700000037_create_pupitre_shield_tables.ts'
  )
  const exists = await access(destination).then(
    () => true,
    () => false
  )
  if (!exists)
    await codemods.makeUsingStub(
      join(import.meta.dirname, 'stubs'),
      'database/migrations/shield.stub',
      { userTable }
    )
  await codemods.updateRcFile((rcFile) => {
    rcFile.addCommand('@rikology/pupitre-shield/commands')
  })
}
