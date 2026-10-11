import type * as AdonisQueue from '@adonisjs/queue'
import type { JobsAdapter } from '../adapters/jobs.js'
import { E_PUPITRE_MISSING_PEER } from '../errors.js'
type PupitreJobPayload = { name: string; payload: Record<string, unknown> }

/** Official adapter for the @adonisjs/queue job registry and dispatcher. */
export function jobsAdapter(): JobsAdapter {
  const handlers = new Map<string, (payload: Record<string, unknown>) => Promise<void>>()
  let initialized: Promise<void> | undefined
  let dispatchRegistered: ((payload: PupitreJobPayload) => Promise<void>) | undefined

  async function initialize() {
    initialized ??= (async () => {
      // @adonisjs/queue is optional; load it only when the driver is configured.
      let queue: typeof AdonisQueue
      try {
        queue = await import('@adonisjs/queue')
      } catch {
        const error = new E_PUPITRE_MISSING_PEER()
        error.message =
          'The optional peer "@adonisjs/queue" is required for the Pupitre queue driver'
        throw error
      }
      const Job = queue.Job
      class PupitreActionJob extends Job<PupitreJobPayload> {
        async execute() {
          const handler = handlers.get(this.payload.name)
          if (!handler)
            throw new Error(`No Pupitre handler registered for job "${this.payload.name}"`)
          await handler(this.payload.payload)
        }
      }
      dispatchRegistered = async (jobData) => {
        await PupitreActionJob.dispatch(jobData).run()
      }
      queue.Locator.register('PupitreActionJob', PupitreActionJob)
    })()
    await initialized
  }

  return {
    initialize,
    async dispatch(name, payload) {
      await initialize()
      if (!dispatchRegistered)
        throw new Error('Pupitre queue driver failed to register its job class')
      await dispatchRegistered({ name, payload })
    },
    register(name, handler) {
      handlers.set(name, handler)
    },
  }
}
