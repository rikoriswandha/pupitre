import { access } from 'node:fs/promises'
import { join } from 'node:path'
import type Configure from '@adonisjs/core/commands/configure'
export async function configure(command: Pick<Configure, 'app' | 'createCodemods'>) {
  const destination = command.app.makePath(
    'database/migrations/1791700000043_create_pupitre_settings_table.ts'
  )
  const exists = await access(destination).then(
    () => true,
    () => false
  )
  if (!exists) {
    const codemods = await command.createCodemods()
    await codemods.makeUsingStub(
      join(import.meta.dirname, 'stubs'),
      'database/migrations/settings.stub',
      {}
    )
  }
}
