import { stripTranslationMarkers, t as translate } from '../../../src/i18n.js'
import { exportJobResponse } from '../../../catalog/wire.js'
import { test } from '@japa/runner'
import { actions, exportColumn, table } from '../../../index.js'
import type { JobsAdapter } from '../../../src/adapters/jobs.js'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  fixturePanel,
  fixturePostResource,
  Post,
  User,
} from '../../helpers/app.js'
import type { TestApplication } from '../../helpers/app.js'
import { teardown } from '../../helpers/db.js'

async function request(
  fixture: TestApplication,
  cookie: string,
  body: unknown = {},
  locale = 'en'
) {
  return fetch(`${fixture.baseUrl}/admin/posts/export?action=export`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Cookie': cookie,
      'Accept-Language': locale,
      'Connection': 'close',
    },
    body: JSON.stringify(body),
  })
}

function deferredJobs() {
  const queued: Record<string, unknown>[] = []
  const handlers = new Map<string, (payload: Record<string, unknown>) => Promise<void>>()
  const adapter: JobsAdapter = {
    register(name, handler) {
      handlers.set(name, handler)
    },
    async dispatch(_name, payload) {
      queued.push(payload)
    },
  }
  return { adapter, queued, handlers }
}

async function actor(fixture: TestApplication) {
  const user = await User.create({
    name: 'Export regression',
    email: `export-${Math.random()}@test.dev`,
  })
  return fixture.loginAs(user)
}

function posts() {
  return fixturePostResource
    .table((t) => t.columns([table.text('title').sortable()]).defaultSort('title', 'asc'))
    .actions({
      header: [actions.export().columns([exportColumn('id'), exportColumn('title')])],
      row: [],
      bulk: [],
    })
}

test.group('confirm export query and lifecycle regressions', (group) => {
  group.each.setup(async () => {
    allowPolicyAbilities()
  })
  group.teardown(async () => {
    await teardown()
  })

  test('clears default ordering from COUNT SQL and keeps primary-key batch tiebreakers', async ({
    assert,
  }) => {
    const countSql: string[] = []
    const batchSql: string[] = []
    const resource = posts().scope((query) => {
      query.where('tenant_id', 1)
      const clone = query.clone.bind(query)
      query.clone = <ClonedResult = LucidRow>() => {
        const cloned = clone<ClonedResult>()
        const count = cloned.count.bind(cloned)
        cloned.count = ((...args: Parameters<typeof count>) => {
          const result = count(...args)
          countSql.push(result.toQuery())
          return result
        }) as typeof cloned.count
        const exec = cloned.exec.bind(cloned)
        cloned.exec = async () => {
          batchSql.push(cloned.toQuery())
          return exec()
        }
        return cloned
      }
    })
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: fixturePanel.resources({ posts: resource }) }) },
    })
    try {
      await Post.query().delete()
      const seed = Array.from({ length: 501 }, (_, index) => ({
        title: 'Same title',
        slug: `batch-${index}`,
        status: 'draft',
        tenant_id: 1,
      }))
      for (let offset = 0; offset < seed.length; offset += 250)
        await fixture.database.table('posts').multiInsert(seed.slice(offset, offset + 250))
      const cookie = await actor(fixture)
      const response = await request(fixture, cookie)
      assert.equal(response.status, 200, await response.clone().text())
      const csv = await response.text()
      const lines = csv.trim().split('\n')
      assert.lengthOf(lines, 502)
      assert.equal(new Set(lines.slice(1).map((line) => line.split(',')[0])).size, 501)
      assert.isAbove(countSql.length, 0)
      for (const sql of countSql) assert.notMatch(sql, /order by/i)
      assert.isAbove(batchSql.length, 1)
      for (const sql of batchSql.filter((value) => !/count\(/i.test(value)))
        assert.match(sql, /order by [`"]?title[`"]? asc, [`"]?id[`"]? asc/i)
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('exports the current result set after queued row count changes', async ({ assert }) => {
    const jobs = deferredJobs()
    let notificationAttempts = 0
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: fixturePanel.resources({ posts: posts() }) }) },
      pupitre: {
        jobs: jobs.adapter,
        exports: { maxSyncRows: 0 },
        auth: { model: async () => ({ default: User }) },
        notifications: {
          async toInbox() {
            notificationAttempts++
            throw new Error('Notification delivery unavailable')
          },
          async inbox() {
            return { items: [], meta: { total: 0, perPage: 10, currentPage: 1, lastPage: 1 } }
          },
          async unreadCount() {
            return 0
          },
          async markRead() {},
        },
      },
    })
    try {
      await Post.query().delete()
      await Post.create({ title: 'Original', slug: 'original', status: 'draft', tenantId: 1 })
      const cookie = await actor(fixture)
      const response = await request(fixture, cookie)
      assert.equal(response.status, 200, await response.clone().text())
      const job = (await response.json()) as { jobId: string; downloadUrl: string }
      await Post.create({
        title: 'New matching row',
        slug: 'new-row',
        status: 'draft',
        tenantId: 1,
      })
      await jobs.handlers.get('pupitre.export')!(jobs.queued[0]!)
      const row = await fixture.database.from('pupitre_exports').where('id', job.jobId).first()
      assert.equal(row.status, 'done')
      assert.equal(row.total_rows, 2)
      const download = await fetch(`${fixture.baseUrl}${job.downloadUrl}`, {
        headers: { Cookie: cookie, Connection: 'close' },
      })
      assert.equal(download.status, 200)
      assert.include(await download.text(), 'New matching row')
      assert.equal(notificationAttempts, 1)
      const selected = await Post.query().where('tenant_id', 1)
      const emptyResponse = await request(fixture, cookie, { ids: selected.map((post) => post.id) })
      assert.equal(emptyResponse.status, 200)
      const emptyJob = (await emptyResponse.json()) as { jobId: string; downloadUrl: string }
      await Post.query().delete()
      await jobs.handlers.get('pupitre.export')!(jobs.queued.at(-1)!)
      const emptyRow = await fixture.database
        .from('pupitre_exports')
        .where('id', emptyJob.jobId)
        .first()
      assert.equal(emptyRow.status, 'done')
      assert.equal(emptyRow.total_rows, 0)
      const emptyDownload = await fetch(`${fixture.baseUrl}${emptyJob.downloadUrl}`, {
        headers: { Cookie: cookie, Connection: 'close' },
      })
      assert.equal(emptyDownload.status, 200)
      assert.include(await emptyDownload.text(), 'id,title')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('retains the configured asynchronous row limit when matching rows grow', async ({
    assert,
  }) => {
    const jobs = deferredJobs()
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: fixturePanel.resources({ posts: posts() }) }) },
      pupitre: { jobs: jobs.adapter, exports: { maxSyncRows: 0, maxAsyncRows: 1 } },
    })
    try {
      await Post.query().delete()
      await Post.create({
        title: 'Within limit',
        slug: 'within-limit',
        status: 'draft',
        tenantId: 1,
      })
      const cookie = await actor(fixture)
      const response = await request(fixture, cookie)
      assert.equal(response.status, 200)
      const job = (await response.json()) as { jobId: string }
      await Post.create({ title: 'Over limit', slug: 'over-limit', status: 'draft', tenantId: 1 })
      await assert.rejects(() => jobs.handlers.get('pupitre.export')!(jobs.queued[0]!))
      const row = await fixture.database.from('pupitre_exports').where('id', job.jobId).first()
      assert.equal(row.status, 'failed')
      assert.include(row.error, 'asynchronous row limit')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('marks context and authorization setup failures failed rather than leaving queued jobs', async ({
    assert,
  }) => {
    const jobs = deferredJobs()
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: fixturePanel.resources({ posts: posts() }) }) },
      pupitre: { jobs: jobs.adapter, exports: { maxSyncRows: 0 } },
    })
    try {
      await Post.query().delete()
      await Post.create({ title: 'Queued', slug: 'queued', status: 'draft', tenantId: 1 })
      const cookie = await actor(fixture)
      for (const failure of ['context', 'authorization']) {
        const response = await request(fixture, cookie)
        assert.equal(response.status, 200)
        const job = (await response.json()) as { jobId: string }
        const payload = jobs.queued.at(-1)!
        if (failure === 'context') payload.panelId = 'removed-panel'
        else denyPolicyAbility('viewAny')
        await assert.rejects(() => jobs.handlers.get('pupitre.export')!(payload))
        const row = await fixture.database.from('pupitre_exports').where('id', job.jobId).first()
        assert.equal(row.status, 'failed')
        assert.isString(row.error)
        allowPolicyAbilities()
      }
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })
  test('queued CSV headers store readable translation intent and worker renders captured locale', async ({
    assert,
  }) => {
    const jobs = deferredJobs()
    const resource = posts().actions({
      header: [actions.export().columns([exportColumn('title').label(translate('Post title'))])],
      row: [],
      bulk: [],
    })
    const fixture = await createTestApp({
      panels: {
        admin: async () => ({
          default: fixturePanel.locale('id').locales(['en', 'id']).resources({ posts: resource }),
        }),
      },
      pupitre: {
        jobs: jobs.adapter,
        exports: { maxSyncRows: 0 },
        auth: { model: async () => ({ default: User }) },
        i18n: { messages: { id: { 'Post title': 'Judul postingan' } } },
      },
    })
    try {
      await Post.query().delete()
      await Post.create({ title: 'Raw title', slug: 'stored-header', status: 'draft', tenantId: 1 })
      const cookie = await actor(fixture)
      const response = await request(fixture, cookie, {}, 'id')
      assert.equal(response.status, 200)
      const job = exportJobResponse.parse(await response.json())
      const payload = jobs.queued[0]
      const persisted = JSON.stringify(payload)
      assert.equal(stripTranslationMarkers(persisted), persisted)
      assert.include(persisted, '"header":"Post title"')
      assert.include(persisted, '"key":"Post title"')
      await jobs.handlers.get('pupitre.export')!(payload)
      const download = await fetch(`${fixture.baseUrl}${job.downloadUrl}`, {
        headers: { Cookie: cookie },
      })
      assert.equal(download.status, 200)
      const csv = await download.text()
      assert.include(csv, 'Judul postingan')
      assert.include(csv, 'Raw title')
      assert.equal(stripTranslationMarkers(csv), csv)
    } finally {
      await closeTestApp(fixture)
    }
  })
})
