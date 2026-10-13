import type { CommandMetaData } from '@adonisjs/core/types/ace'
export async function getMetaData(): Promise<CommandMetaData[]> {
  return [
    {
      commandName: 'backup:run',
      description: 'Create a private database backup',
      namespace: 'backup',
      aliases: [],
      args: [],
      flags: [
        { name: 'connection', flagName: 'connection', type: 'string' },
        { name: 'panel', flagName: 'panel', type: 'string' },
      ],
      options: { startApp: true },
    },
  ]
}
export async function getCommand() {
  // Ace must inspect metadata before booting the app; load the command only on execution.
  const command = await import('./run.js')
  return command.default
}
