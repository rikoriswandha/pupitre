import { access } from 'node:fs/promises'
import { join } from 'node:path'
import type Configure from '@adonisjs/core/commands/configure'
export async function configure(command: Pick<Configure, 'app' | 'createCodemods'>) {
  const destination = command.app.makePath(
    'database/migrations/1791700000047_create_pupitre_media_table.ts'
  )
  if (
    await access(destination).then(
      () => true,
      () => false
    )
  )
    return
  const codemods = await command.createCodemods()
  await codemods.makeUsingStub(
    join(import.meta.dirname, 'stubs'),
    'database/migrations/media.stub',
    {}
  )
}
