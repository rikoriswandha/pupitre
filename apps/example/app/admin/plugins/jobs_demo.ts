import { action, definePlugin } from '@rikology/pupitre'
import { flushJobRuns } from '@rikology/pupitre-jobs'
import MonitorDemoJob from '../../jobs/monitor_demo_job.js'

export const jobsDemo = definePlugin({
  name: 'jobs-demo',
  extendResource(resource) {
    if (resource.slug !== 'jobs') return resource
    return {
      ...resource,
      actions: {
        row: resource.actions?.row ?? [],
        bulk: resource.actions?.bulk ?? [],
        header: [
          ...(resource.actions?.header ?? []),
          {
            ...action('run-demo')
              .label('Run report job')
              .can('prune')
              .handle(async ({ ctx }) => {
                if (!ctx?.pupitre.tenant) throw new Error('A tenant is required')
                await MonitorDemoJob.dispatch({
                  tenantId: Number(ctx.pupitre.tenant.id),
                  name: 'Post status report',
                }).run()
                await flushJobRuns()
              }).definition,
            context: 'header',
          },
        ],
      },
    }
  },
})
