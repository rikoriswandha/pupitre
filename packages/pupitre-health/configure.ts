import { access } from 'node:fs/promises'
import { join } from 'node:path'
import type Configure from '@adonisjs/core/commands/configure'

/** Publishes the host-owned check registry without overwriting existing configuration. */
export async function configure(command: Pick<Configure, 'app' | 'createCodemods'>) {
  const codemods = await command.createCodemods()
  const exists = await access(command.app.startPath('health.ts')).then(
    () => true,
    () => false
  )
  if (exists) return
  await codemods.makeUsingStub(join(import.meta.dirname, 'stubs'), 'start/health.stub', {})
}
