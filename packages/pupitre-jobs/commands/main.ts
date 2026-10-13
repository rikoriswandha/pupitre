import type { CommandMetaData } from '@adonisjs/core/types/ace'
import JobsPrune from './prune.js'
export async function getMetaData(): Promise<CommandMetaData[]> {
  return [
    {
      commandName: 'jobs:prune',
      description: JobsPrune.description,
      help: '',
      namespace: 'jobs',
      aliases: [],
      args: [],
      flags: [
        {
          name: 'days',
          flagName: 'days',
          required: false,
          type: 'number',
          description: 'Retention in days',
        },
      ],
      options: { startApp: true },
    },
  ]
}
export async function getCommand(metadata: CommandMetaData) {
  return metadata.commandName === 'jobs:prune' ? JobsPrune : null
}
