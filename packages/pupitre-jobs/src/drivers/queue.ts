import type { Database } from '@adonisjs/lucid/database'
import type { JobData, AcquiredJob } from '@adonisjs/queue/types'
import { DateTime } from 'luxon'
import { t } from '@rikology/pupitre'
import { E_PUPITRE_JOB_RETRY } from '../errors.js'

const sensitive = /password|secret|token|key|authorization|cookie/i
export function redactPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPayload)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitive.test(key) ? '[REDACTED]' : redactPayload(item),
      ])
    )
  }
  return value
}
function scrubError(text: string, payload: unknown): string {
  let result = text
  function walk(value: unknown, hidden = false) {
    if (hidden && typeof value === 'string' && value)
      result = result.split(value).join('[REDACTED]')
    if (Array.isArray(value)) value.forEach((item) => walk(item, hidden))
    else if (value && typeof value === 'object')
      Object.entries(value).forEach(([key, item]) => walk(item, hidden || sensitive.test(key)))
  }
  walk(payload)
  return result
}
export type MonitorDependencies = {
  database: Database
  encrypt: (value: unknown) => string
  tenantId?: (job: JobData) => string | number | null
}
export type JobMonitor = { flush(): Promise<void>; stop(): Promise<void> }
export async function monitorJobs(dependencies: MonitorDependencies) {
  // The queue peer is optional and must not load before monitoring is configured.
  const { tracingChannels } = await import('@adonisjs/queue')
  let pending = Promise.resolve()
  let failure: unknown
  const enqueue = (work: () => Promise<void>) => {
    pending = pending.then(work).catch((error: unknown) => {
      failure ??= error
    })
  }
  const timestamp = () => DateTime.utc().toSQL()!
  const create = async (job: JobData, queue: string, attempt: number) => {
    const payload = job.payload as unknown
    const object =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
    const inner =
      object.payload && typeof object.payload === 'object'
        ? (object.payload as Record<string, unknown>)
        : {}
    const tenant = dependencies.tenantId
      ? dependencies.tenantId(job)
      : (object.tenantId ?? inner.tenantId ?? null)
    await dependencies.database
      .table('pupitre_job_runs')
      .insert({
        id: `${job.id}:${attempt}`,
        job_id: job.id,
        name: job.name,
        queue,
        status: 'queued',
        attempt,
        tenant_id: tenant === null ? null : String(tenant),
        payload_summary: JSON.stringify(redactPayload(payload)),
        retry_payload: dependencies.encrypt(payload),
        retry_safe: true,
        queued_at: DateTime.fromMillis(job.createdAt ?? Date.now(), { zone: 'utc' }).toSQL(),
      })
      .onConflict('id')
      .ignore()
  }
  const dispatchHandlers = {
    start(raw: unknown) {
      const message = raw as { jobs: JobData[]; queue: string }
      for (const job of message.jobs) enqueue(() => create(job, message.queue, 1))
    },
  }
  const executionHandlers = {
    start(raw: unknown) {
      const message = raw as { job: AcquiredJob; queue: string }
      const job = message.job
      const startedAt = timestamp()
      enqueue(async () => {
        await create(job, message.queue, job.attempts + 1)
        await dependencies.database
          .from('pupitre_job_runs')
          .where('id', `${job.id}:${job.attempts + 1}`)
          .update({ status: 'running', started_at: startedAt })
      })
    },
    asyncEnd(raw: unknown) {
      const message = raw as { job: AcquiredJob; status?: string; duration?: number; error?: Error }
      const { job, status, duration, error } = message
      const finishedAt = timestamp()
      const errorMessage = error ? scrubError(error.message, job.payload).slice(0, 2000) : null
      const errorStack = error?.stack ? scrubError(error.stack, job.payload).slice(0, 8000) : null
      enqueue(async () => {
        await dependencies.database
          .from('pupitre_job_runs')
          .where('id', `${job.id}:${job.attempts + 1}`)
          .update({
            status: status ?? 'failed',
            finished_at: finishedAt,
            duration_ms: duration ?? null,
            error_message: errorMessage,
            error_stack: errorStack,
          })
      })
    },
  }
  tracingChannels.dispatchChannel.subscribe(dispatchHandlers)
  tracingChannels.executeChannel.subscribe(executionHandlers)
  return {
    async flush() {
      await pending
      if (failure) throw failure
    },
    async stop() {
      tracingChannels.dispatchChannel.unsubscribe(dispatchHandlers)
      tracingChannels.executeChannel.unsubscribe(executionHandlers)
      await pending
      if (failure) throw failure
    },
  }
}
export async function registeredJob(name: string) {
  // Registry access is unavailable when the optional queue peer is absent.
  const { Locator } = await import('@adonisjs/queue')
  return Locator.get(name)
}
export async function dispatchJob(name: string, payload: unknown, queue: string) {
  const job = await registeredJob(name)
  if (!job) throw new E_PUPITRE_JOB_RETRY([t('Job is not registered')])
  // Dispatch is a public base-class API; Locator's constructor type omits static methods.
  const { Job } = await import('@adonisjs/queue')
  return Job.dispatch.call(job, payload).toQueue(queue).run()
}
