import type Configure from '@adonisjs/core/commands/configure'
export async function configure(command: Pick<Configure, 'logger'>) {
  command.logger.info(
    'Register calendar({ pages: [...] }) in your panel plugins. The Calendar component is included in the pupitre-ui components registry; no provider or migrations are needed.'
  )
}
