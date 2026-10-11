import { QueueManager, Locator } from '@adonisjs/queue'
import { sync } from '@boringnode/queue/drivers/sync_adapter'
import { jobsAdapter } from '../../src/drivers/queue.js'

/** Boots the official Pupitre queue driver over Boringnode's synchronous adapter. */
export async function setupSyncJobsAdapter() {
  if (QueueManager.isInitialized()) await QueueManager.destroy()
  Locator.clear()
  await QueueManager.init({
    default: 'sync',
    adapters: { sync: sync() },
    locations: [],
    autoLoadJobs: false,
  })
  const adapter = jobsAdapter()
  return {
    adapter,
    async teardown() {
      await QueueManager.destroy()
      Locator.clear()
    },
  }
}
