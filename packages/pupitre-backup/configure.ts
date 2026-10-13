import { access } from 'node:fs/promises'
import { join } from 'node:path'
import type Configure from '@adonisjs/core/commands/configure'
export async function configure(command: Pick<Configure, 'app' | 'createCodemods'>) {
  const codemods = await command.createCodemods()
  const exists = await access(
    command.app.makePath('database/migrations/1791700000049_create_pupitre_backups_table.ts')
  ).then(
    () => true,
    () => false
  )
  if (!exists)
    await codemods.makeUsingStub(
      join(import.meta.dirname, 'stubs'),
      'database/migrations/backups.stub',
      {}
    )
  await codemods.updateRcFile((rcFile) => rcFile.addCommand('@rikology/pupitre-backup/commands'))
}
