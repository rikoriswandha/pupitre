import type Configure from '@adonisjs/core/commands/configure'

/**
 * Hook executed by `node ace add @rikology/pupitre`.
 */
export async function configure(command: Configure) {
  const codemods = await command.createCodemods()
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@rikology/pupitre/pupitre_provider')
  })
}
