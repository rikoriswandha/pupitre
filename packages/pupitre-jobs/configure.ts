import { access } from 'node:fs/promises'
import { join } from 'node:path'
import type Configure from '@adonisjs/core/commands/configure'
export async function configure(command: Pick<Configure, 'app' | 'createCodemods'>) {
  const destination = command.app.makePath(
    'database/migrations/1791700000048_create_pupitre_job_runs_table.ts'
  )
  const exists = await access(destination).then(
    () => true,
    () => false
  )
  const codemods = await command.createCodemods()
  if (!exists)
    await codemods.makeUsingStub(
      join(import.meta.dirname, 'stubs'),
      'database/migrations/jobs.stub',
      {}
    )
  await codemods.updateRcFile((rcFile) => {
    rcFile.addCommand('@rikology/pupitre-jobs/commands')
  })
}
