import { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import type { Database } from '@adonisjs/lucid/database'
import {
  action,
  actions,
  definePlugin,
  defineResource,
  defineWidget,
  nav,
  pages,
  stat,
  table,
  t,
} from '@rikology/pupitre'
import { DateTime } from 'luxon'
import { JobRun } from './src/job_run.js'
import { monitorJobs, registeredJob, dispatchJob } from './src/drivers/queue.js'
import type { JobMonitor } from './src/drivers/queue.js'
import { E_PUPITRE_JOB_FORBIDDEN, E_PUPITRE_JOB_RETRY } from './src/errors.js'
export { JobRun } from './src/job_run.js'
export { monitorJobs, redactPayload } from './src/drivers/queue.js'
export { configure } from './configure.js'
export type { JobMonitor, MonitorDependencies } from './src/drivers/queue.js'

export type JobsOptions = {
  navigationGroup?: string
  retentionDays?: number
  authorize?: (
    ctx: HttpContext,
    ability: 'viewAny' | 'view' | 'retry' | 'delete' | 'prune',
    record?: JobRun
  ) => boolean | Promise<boolean>
  allowRetry?: (ctx: HttpContext, record: JobRun) => boolean | Promise<boolean>
}
let monitor: JobMonitor | undefined
async function authorizeJob(
  ctx: HttpContext,
  options: JobsOptions,
  ability: Parameters<NonNullable<JobsOptions['authorize']>>[1],
  record?: JobRun
) {
  if (options.authorize) return options.authorize(ctx, ability, record)
  const config = await app.container.make('pupitre.config')
  const policies = await config.policies?.()
  const candidate = policies?.JobRunPolicy
  const policy =
    candidate && typeof candidate === 'object' && 'default' in candidate
      ? candidate.default
      : candidate
  const bouncer = (
    ctx as HttpContext & {
      bouncer?: {
        with(value: typeof policy): { allows(ability: string, record?: JobRun): Promise<boolean> }
      }
    }
  ).bouncer
  if (
    typeof policy !== 'function' ||
    !('prototype' in policy) ||
    typeof policy.prototype[ability] !== 'function' ||
    !bouncer
  )
    return false
  return bouncer.with(policy).allows(ability, record)
}
export async function flushJobRuns() {
  await monitor?.flush()
}
export async function pruneJobRuns(retentionDays = 7, tenantId?: string | null) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1)
    throw new RangeError('retentionDays must be a positive integer')
  await flushJobRuns()
  const query = JobRun.query()
    .where('queued_at', '<', DateTime.utc().minus({ days: retentionDays }).toSQL()!)
    .whereIn('status', ['completed', 'failed'])
  if (tenantId !== undefined) {
    if (tenantId === null) query.whereNull('tenant_id')
    else query.where('tenant_id', tenantId)
  }
  return query.delete()
}
export async function retryJobRun(ctx: HttpContext, record: JobRun, options: JobsOptions) {
  if (!(await authorizeJob(ctx, options, 'retry', record)))
    throw new E_PUPITRE_JOB_FORBIDDEN([t('Job retry is forbidden')])
  const tenant = ctx.pupitre?.tenant?.id
  if (String(tenant ?? '') !== String(record.tenantId ?? ''))
    throw new E_PUPITRE_JOB_FORBIDDEN([t('Job retry is forbidden')])
  if (
    record.status !== 'failed' ||
    !record.retryPayload ||
    !record.retrySafe ||
    !options.allowRetry ||
    !(await options.allowRetry(ctx, record))
  )
    throw new E_PUPITRE_JOB_RETRY([t('Job retry is not allowed')])
  if (!(await registeredJob(record.name)))
    throw new E_PUPITRE_JOB_RETRY([t('Job is not registered')])
  const encryption = await app.container.make('encryption')
  const payload = encryption.decrypt<unknown>(record.retryPayload)
  if (payload === null) throw new E_PUPITRE_JOB_RETRY([t('Job payload cannot be decrypted')])
  await dispatchJob(record.name, payload, record.queue)
  await flushJobRuns()
}
export function jobs(options: JobsOptions = {}) {
  const retentionDays = options.retentionDays ?? 7
  if (!Number.isInteger(retentionDays) || retentionDays < 1)
    throw new RangeError('retentionDays must be a positive integer')
  class JobRunPolicy {
    static containerInjections = {
      _constructor: {
        dependencies: [HttpContext],
        createError: (message: string) => new Error(message),
      },
    }
    constructor(private ctx: HttpContext) {}
    async viewAny() {
      await flushJobRuns()
      return authorizeJob(this.ctx, options, 'viewAny')
    }
    async view(_user: unknown, record: JobRun) {
      return authorizeJob(this.ctx, options, 'view', record)
    }
    async delete(_user: unknown, record: JobRun) {
      return authorizeJob(this.ctx, options, 'delete', record)
    }
    async retry(_user: unknown, record: JobRun) {
      if (
        !(await authorizeJob(this.ctx, options, 'retry', record)) ||
        record.status !== 'failed' ||
        !record.retryPayload ||
        !record.retrySafe ||
        !options.allowRetry ||
        !(await options.allowRetry(this.ctx, record)) ||
        !(await registeredJob(record.name))
      )
        return false
      const encryption = await app.container.make('encryption')
      return encryption.decrypt(record.retryPayload) !== null
    }
    async prune() {
      return authorizeJob(this.ctx, options, 'prune')
    }
  }
  const statusOptions = {
    queued: t('Queued'),
    running: t('Running'),
    completed: t('Completed'),
    failed: t('Failed'),
    retrying: t('Retrying'),
  }
  const stats = defineWidget('jobs-stats')
    .heading(t('Jobs in the last 24 hours'))
    .stats(async ({ ctx }) => {
      if (!(await authorizeJob(ctx, options, 'viewAny')))
        throw new E_PUPITRE_JOB_FORBIDDEN([t('Job monitor is forbidden')])
      await flushJobRuns()
      const query = JobRun.query().where(
        'queued_at',
        '>=',
        DateTime.utc().minus({ hours: 24 }).toSQL()!
      )
      const tenant = ctx.pupitre.tenant?.id
      if (tenant === undefined) query.whereNull('tenant_id')
      else query.where('tenant_id', String(tenant))
      const [totals, failures, durations] = await Promise.all([
        query.clone().count('* as total'),
        query.clone().where('status', 'failed').count('* as total'),
        query.clone().avg('duration_ms as duration'),
      ])
      return [
        stat(t('Job runs'), Number(totals[0]?.$extras.total ?? 0)),
        stat(t('Failed'), Number(failures[0]?.$extras.total ?? 0)).color('danger'),
        stat(t('Average duration (ms)'), Math.round(Number(durations[0]?.$extras.duration ?? 0))),
      ]
    })
  const resource = defineResource(JobRun)
    .slug('jobs')
    .label(t('Job run'))
    .pluralLabel(t('Jobs'))
    .icon('list-checks')
    .navigation({ group: options.navigationGroup ?? t('Administration') })
    .recordTitle('name')
    .policy(JobRunPolicy)
    .scope((query, ctx) => {
      const tenant = ctx.pupitre.tenant?.id
      if (tenant === undefined) query.whereNull('tenant_id')
      else query.where('tenant_id', String(tenant))
    })
    .table((builder) =>
      builder
        .columns([
          table.text('name').label(t('Name')).searchable(),
          table.badge('status').label(t('Status')).options(statusOptions),
          table.text('queue').label(t('Queue')),
          table.text('attempt').label(t('Attempt')),
          table.text('durationMs').label(t('Duration (ms)')),
          table.text('queuedAt').label(t('Queued at')).sortable(),
        ])
        .filters([table.filter.select('status').options(statusOptions)])
        .defaultSort('queuedAt', 'desc')
    )
    .infolist((schema) => [
      schema.textEntry('name').label(t('Name')),
      schema.textEntry('status').label(t('Status')).options(statusOptions),
      schema.textEntry('queue').label(t('Queue')),
      schema.textEntry('attempt').label(t('Attempt')),
      schema.textEntry('payloadSummary').label(t('Payload')),
      schema.textEntry('errorMessage').label(t('Error')),
      schema.textEntry('errorStack').label(t('Stack trace')),
      schema.textEntry('queuedAt').label(t('Queued at')),
      schema.textEntry('startedAt').label(t('Started at')),
      schema.textEntry('finishedAt').label(t('Finished at')),
    ])
    .actions({
      row: [
        actions.view(),
        action('retry')
          .label(t('Retry failed job'))
          .can('retry')
          .handle(async ({ record, ctx }) => {
            if (!ctx) throw new E_PUPITRE_JOB_FORBIDDEN([t('Job retry is forbidden')])
            await retryJobRun(ctx, record as JobRun, options)
          }),
        actions.delete(),
      ],
      header: [
        action('prune')
          .label(t('Prune old job runs'))
          .can('prune')
          .requiresConfirmation()
          .handle(async ({ ctx }) => {
            if (!ctx || !(await authorizeJob(ctx, options, 'prune')))
              throw new E_PUPITRE_JOB_FORBIDDEN([t('Job prune is forbidden')])
            await pruneJobRuns(
              retentionDays,
              ctx.pupitre.tenant ? String(ctx.pupitre.tenant.id) : null
            )
          }),
      ],
    })
    .pages({
      list: pages
        .list()
        .widgets([stats])
        .tabs({
          all: { label: t('All') },
          ...Object.fromEntries(
            Object.entries(statusOptions).map(([status, label]) => [
              status,
              { label, where: { status } },
            ])
          ),
        }),
      view: pages.view(),
    })
  return definePlugin({
    name: 'jobs',
    resources: [resource],
    navigation: [
      nav
        .group(options.navigationGroup ?? t('Administration'))
        .items([nav.item().resource('jobs')]),
    ],
    async boot() {
      if (!monitor) {
        const database = (await app.container.make('lucid.db')) as Database
        const encryption = await app.container.make('encryption')
        monitor = await monitorJobs({ database, encrypt: (value) => encryption.encrypt(value) })
        app.terminating(async () => {
          await monitor?.stop()
          monitor = undefined
        })
      }
    },
  })
}
