import { test } from '@japa/runner'
import { Job, Locator, QueueManager } from '@adonisjs/queue'
import { sync } from '@boringnode/queue/drivers/sync_adapter'
import { definePanel } from '@rikology/pupitre'
import type { PanelRuntime } from '@rikology/pupitre'
import type { PupitreConfig } from '@rikology/pupitre'
import { createColumnTenancyAdapter } from '../../pupitre/src/tenancy/column_driver.js'
import { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { jobs, JobRun, flushJobRuns, pruneJobRuns, retryJobRun, redactPayload } from '../index.js'
import { createTestApp, closeTestApp, Post } from '../../pupitre/tests/helpers/app.js'
import { teardown } from '../../pupitre/tests/helpers/db.js'
import Migration from './fixtures/migration.js'

class HostJob extends Job<{ tenantId?: number; password?: string; fail?: boolean }> {
  static options = { maxRetries: 0 }
  async execute() {
    if (this.payload.fail) throw new Error(`Failure ${this.payload.password ?? ''}`)
  }
}
class RetryHostJob extends Job {
  static options = { maxRetries: 1, backoff: { type: 'fixed' as const, delay: 1 } }
  async execute() {
    if (this.context.attempt === 1) throw new Error('First attempt failed')
  }
}
const options = { authorize: () => true, allowRetry: () => true }
async function fixture(
  authorized = true,
  policies?: PupitreConfig['policies'],
  useHostPolicy = false
) {
  await QueueManager.init({ default: 'sync', adapters: { sync: sync() }, autoLoadJobs: false })
  Locator.register('HostJob', HostJob)
  Locator.register('RetryHostJob', RetryHostJob)
  return createTestApp({
    pupitre: { policies },
    panels: {
      admin: async () => ({
        default: definePanel('admin').plugins([
          jobs({ ...options, authorize: useHostPolicy ? undefined : () => authorized }),
        ]),
      }),
    },
    setup: async (router, app) => {
      router.use([
        () =>
          Promise.resolve({
            default: class {
              async handle(ctx: HttpContext, next: () => Promise<unknown>) {
                ctx.containerResolver.bindValue(HttpContext, ctx)
                return next()
              }
            },
          }),
      ])
      const database = await app.container.make('lucid.db')
      await database.connection().schema.dropTableIfExists('pupitre_job_runs')
      await new Migration(database.connection(), 'jobs').execUp()
    },
  })
}

test.group('job monitoring', (suite) => {
  suite.teardown(teardown)
  test('default tenancy scopes text IDs and retains integer ownership on create', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      await HostJob.dispatch({ tenantId: 2 }).run()
      await HostJob.dispatch({ tenantId: 3 }).run()
      await flushJobRuns()
      const tenant = { id: 2, name: 'Tenant 2' }
      const adapter = createColumnTenancyAdapter({
        tenancy: { model: async () => ({ default: JobRun }), tenantsForUser: async () => [] },
      } as unknown as PanelRuntime)
      const ctx = {} as HttpContext
      const query = JobRun.query()
      adapter.scope(query, tenant, { ownership: 'tenant_id', model: JobRun, ctx })
      const scoped = await query
      assert.lengthOf(scoped, 1)
      assert.equal(scoped[0]!.tenantId, '2')
      const data = adapter.fill({}, tenant, { ownership: 'tenant_id', model: Post, ctx })
      assert.strictEqual(data.tenantId, 2)
      const post = await Post.create({
        title: 'Typed tenant ownership',
        slug: 'typed-tenant-ownership',
        status: 'draft',
        tenantId: data.tenantId as number,
      })
      const database = await app.app.container.make('lucid.db')
      if (process.env.DB === 'pg') {
        const result = await database.rawQuery(
          'select pg_typeof(tenant_id)::text as type from posts where id = ?',
          [post.id]
        )
        assert.equal(result.rows[0].type, 'integer')
      } else {
        const result = await database.rawQuery(
          'select typeof(tenant_id) as type from posts where id = ?',
          [post.id]
        )
        assert.equal(result[0].type, 'integer')
      }
    } finally {
      await closeTestApp(app)
      await QueueManager.destroy()
    }
  })
  test('monitor table and stats display an authorized global run', async ({ assert }) => {
    const app = await fixture()
    try {
      const dispatch = await HostJob.dispatch({}).run()
      await flushJobRuns()
      const response = await fetch(`${app.baseUrl}/admin/jobs`, {
        headers: { 'Accept': 'text/html', 'X-Inertia': 'true', 'X-Inertia-Version': '1' },
      })
      const body = await response.text()
      assert.equal(response.status, 200, body)
      assert.include(body, 'HostJob')
      const detail = await fetch(
        `${app.baseUrl}/admin/jobs/${encodeURIComponent(`${dispatch.jobId}:1`)}`,
        { headers: { 'Accept': 'text/html', 'X-Inertia': 'true', 'X-Inertia-Version': '1' } }
      )
      assert.equal(detail.status, 200, await detail.clone().text())
      assert.include(await detail.text(), 'payloadSummary')
    } finally {
      await closeTestApp(app)
      await QueueManager.destroy()
    }
  })
  test('host JobRunPolicy authorizes pages and stats without a callback, missing methods deny', async ({
    assert,
  }) => {
    class HostPolicy {
      viewAny() {
        return true
      }
      view(_user: unknown, record: JobRun) {
        return record.name === 'HostJob'
      }
      retry(_user: unknown, record: JobRun) {
        return record.name === 'HostJob'
      }
      prune() {
        return true
      }
    }
    for (const candidate of [HostPolicy, { default: HostPolicy }, undefined]) {
      const app = await fixture(
        true,
        async () => (candidate ? { JobRunPolicy: candidate } : {}),
        true
      )
      try {
        const dispatch = await HostJob.dispatch({}).run()
        await flushJobRuns()
        const response = await fetch(`${app.baseUrl}/admin/jobs`, {
          headers: { 'Accept': 'application/json', 'X-Inertia': 'true', 'X-Inertia-Version': '1' },
        })
        assert.equal(response.status, candidate ? 200 : 403, await response.clone().text())
        if (!candidate) continue
        assert.include(await response.text(), 'HostJob')
        const detail = await fetch(
          `${app.baseUrl}/admin/jobs/${encodeURIComponent(`${dispatch.jobId}:1`)}`,
          {
            headers: {
              'Accept': 'application/json',
              'X-Inertia': 'true',
              'X-Inertia-Version': '1',
            },
          }
        )
        assert.equal(detail.status, 200, await detail.text())
        const stats = await fetch(
          `${app.baseUrl}/admin/_pupitre/widgets/jobs-stats?resource=jobs&widgetPage=list`,
          {
            headers: { Accept: 'application/json' },
          }
        )
        assert.equal(stats.status, 200, await stats.text())
        const denied = await fetch(
          `${app.baseUrl}/admin/jobs/${encodeURIComponent(`${dispatch.jobId}:1`)}`,
          {
            method: 'DELETE',
            headers: { 'Accept': 'application/json', 'X-Pupitre-Action': '1' },
          }
        )
        assert.equal(denied.status, 403, await denied.text())
        assert.isNotNull(await JobRun.find(`${dispatch.jobId}:1`))
        const failedDispatch = await HostJob.dispatch({ fail: true }).run()
        await flushJobRuns()
        const retry = await fetch(
          `${app.baseUrl}/admin/jobs/${encodeURIComponent(`${failedDispatch.jobId}:1`)}/actions/retry`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'X-Pupitre-Action': '1',
              'Content-Type': 'application/json',
            },
            body: '{}',
          }
        )
        assert.equal(retry.status, 200, await retry.text())
        assert.lengthOf(await JobRun.all(), 3)
        await app.database
          .from('pupitre_job_runs')
          .where('id', `${dispatch.jobId}:1`)
          .update({ queued_at: DateTime.utc().minus({ days: 8 }).toSQL()! })
        const pruned = await fetch(`${app.baseUrl}/admin/jobs/actions/prune`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'X-Pupitre-Action': '1',
            'Content-Type': 'application/json',
          },
          body: '{}',
        })
        assert.equal(pruned.status, 200, await pruned.text())
        assert.isNull(await JobRun.find(`${dispatch.jobId}:1`))
      } finally {
        await closeTestApp(app)
        await QueueManager.destroy()
      }
    }
  }).timeout(30000)
  test('captures all host jobs, failures and each real sync retry attempt', async ({ assert }) => {
    const app = await fixture()
    try {
      await HostJob.dispatch({ password: 'do-not-expose', fail: true }).run()
      await RetryHostJob.dispatch({}).run()
      await flushJobRuns()
      const runs = await JobRun.query().orderBy('queued_at')
      assert.lengthOf(runs, 3)
      const failed = runs.find((run) => run.name === 'HostJob')!
      assert.equal(failed.status, 'failed')
      assert.equal(failed.attempt, 1)
      assert.notInclude(failed.payloadSummary, 'do-not-expose')
      assert.notInclude(failed.errorMessage!, 'do-not-expose')
      assert.notInclude(failed.errorStack!, 'do-not-expose')
      assert.isNotNull(failed.startedAt)
      assert.isNotNull(failed.finishedAt)
      assert.isAtLeast(Number(failed.durationMs), 0)
      assert.deepEqual(
        runs.filter((run) => run.name === 'RetryHostJob').map((run) => [run.attempt, run.status]),
        [
          [1, 'retrying'],
          [2, 'completed'],
        ]
      )
      assert.notProperty(failed.serialize(), 'retryPayload')
    } finally {
      await closeTestApp(app)
      await QueueManager.destroy()
    }
  })
  test('redacts recursively including nested arrays and mixed-case credential keys', ({
    assert,
  }) => {
    assert.deepEqual(
      redactPayload({
        items: [
          {
            Password: 'secret',
            nested: { apiKey: 1, authorization: 'bearer', Cookie: 'cookie', harmless: 42 },
          },
        ],
        token: 'token',
        name: 'safe',
      }),
      {
        items: [
          {
            Password: '[REDACTED]',
            nested: {
              apiKey: '[REDACTED]',
              authorization: '[REDACTED]',
              Cookie: '[REDACTED]',
              harmless: 42,
            },
          },
        ],
        token: '[REDACTED]',
        name: 'safe',
      }
    )
  })
  test('retries encrypted original payload only with permission and a registered job', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      await HostJob.dispatch({ fail: true }).run()
      await flushJobRuns()
      const run = await JobRun.firstOrFail()
      const ctx = { pupitre: { tenant: null } } as unknown as HttpContext
      await assert.rejects(
        () => retryJobRun(ctx, run, { ...options, authorize: () => false }),
        /Job retry is forbidden/
      )
      await assert.rejects(
        () => retryJobRun(ctx, run, { ...options, allowRetry: () => false }),
        /Job retry is not allowed/
      )
      const otherTenant = { pupitre: { tenant: { id: 2 } } } as unknown as HttpContext
      await assert.rejects(() => retryJobRun(otherTenant, run, options), /Job retry is forbidden/)
      run.name = 'MissingJob'
      await assert.rejects(() => retryJobRun(ctx, run, options), /Job is not registered/)
      run.name = 'HostJob'
      await retryJobRun(ctx, run, options)
      assert.lengthOf(await JobRun.all(), 2)
    } finally {
      await closeTestApp(app)
      await QueueManager.destroy()
    }
  })
  test('denies monitor access before data is queried', async ({ assert }) => {
    const app = await fixture(false)
    try {
      const response = await fetch(`${app.baseUrl}/admin/jobs`, {
        headers: { Accept: 'application/json' },
      })
      assert.equal(response.status, 403, await response.text())
    } finally {
      await closeTestApp(app)
      await QueueManager.destroy()
    }
  })
  test('global monitor cannot view or delete tenant-owned runs', async ({ assert }) => {
    const app = await fixture()
    try {
      const dispatch = await HostJob.dispatch({ tenantId: 2 }).run()
      await flushJobRuns()
      const id = encodeURIComponent(`${dispatch.jobId}:1`)
      const viewed = await fetch(`${app.baseUrl}/admin/jobs/${id}`, {
        headers: { Accept: 'application/json' },
      })
      assert.equal(viewed.status, 404)
      const deleted = await fetch(`${app.baseUrl}/admin/jobs/${id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      })
      assert.equal(deleted.status, 404)
      assert.isNotNull(await JobRun.find(`${dispatch.jobId}:1`))
    } finally {
      await closeTestApp(app)
      await QueueManager.destroy()
    }
  })
  test('prunes only old terminal runs and honors tenant boundary', async ({ assert }) => {
    const app = await fixture()
    try {
      const first = await HostJob.dispatch({}).run()
      const second = await HostJob.dispatch({ tenantId: 2 }).run()
      const third = await HostJob.dispatch({}).run()
      await flushJobRuns()
      const firstRun = await JobRun.findOrFail(`${first.jobId}:1`)
      const secondRun = await JobRun.findOrFail(`${second.jobId}:1`)
      const thirdRun = await JobRun.findOrFail(`${third.jobId}:1`)
      assert.equal(secondRun.tenantId, '2')
      await firstRun.merge({ queuedAt: DateTime.utc().minus({ days: 10 }).toSQL()! }).save()
      await secondRun.merge({ queuedAt: DateTime.utc().minus({ days: 10 }).toSQL()! }).save()
      await thirdRun
        .merge({ queuedAt: DateTime.utc().minus({ days: 10 }).toSQL()!, status: 'running' })
        .save()
      await pruneJobRuns(7, null)
      const remaining = await JobRun.all()
      assert.lengthOf(remaining, 2)
      assert.isTrue(remaining.some((run) => run.tenantId === '2'))
      assert.isTrue(remaining.some((run) => run.status === 'running'))
      await assert.rejects(() => pruneJobRuns(0), 'retentionDays must be a positive integer')
    } finally {
      await closeTestApp(app)
      await QueueManager.destroy()
    }
  })
})
