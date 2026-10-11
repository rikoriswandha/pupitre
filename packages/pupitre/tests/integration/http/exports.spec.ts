import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import { exportJobResponse, exportProgressResponse } from '../../../catalog/wire.js'
import { setupSyncJobsAdapter } from '../../helpers/queue.js'
import User from '../../fixtures/models/user.js'
import { actions, exportColumn, table } from '../../../index.js'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  fixtureCategoryResource,
  fixturePanel,
  fixturePostResource,
  Post,
} from '../../helpers/app.js'
import type { TestApplication } from '../../helpers/app.js'
import { teardown } from '../../helpers/db.js'

async function createPost(title: string, status = 'draft', tenantId = 1) {
  return Post.create({ title, slug: `${title}-${Math.random()}`, status, tenantId })
}

async function exportRequest(fixture: TestApplication, query: string, body: unknown = {}) {
  return fetch(`${fixture.baseUrl}/admin/posts/export?action=export`, {
    method: 'POST',
    headers: {
      'Accept': 'text/csv',
      'Content-Type': 'application/json',
      'X-Pupitre-Action': '1',
      'X-Pupitre-Url': `/admin/posts${query}`,
      'Connection': 'close',
    },
    body: JSON.stringify(body),
  })
}

test.group('Pupitre CSV exports', (group) => {
  let fixture: TestApplication
  group.setup(async () => {
    const posts = fixturePostResource.actions({
      header: [
        actions.create(),
        actions.export().columns([
          exportColumn('title')
            .label('Post title')
            .formatStateUsing((value) => String(value ?? '').toUpperCase()),
        ]),
      ],
      row: [],
      bulk: [actions.export()],
    })
    const panel = fixturePanel.resources({ posts, categories: fixtureCategoryResource })
    fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
  })
  group.teardown(async () => {
    await closeTestApp(fixture)
    await teardown()
  })
  group.each.setup(async () => {
    allowPolicyAbilities()
    await Post.query().delete()
  })

  test('exports formatted rows after nested filters and individual search', async ({ assert }) => {
    await createPost('A match', 'draft', 1)
    await createPost('Z match', 'draft', 1)
    await createPost('Other', 'draft', 1)
    await createPost('Published match', 'published', 1)
    await createPost('Tenant leak match', 'draft', 2)
    const response = await exportRequest(
      fixture,
      '?filters%5Bstatus%5D=draft&columns%5Btitle%5D%5Bsearch%5D=match&sort=-title'
    )
    assert.equal(response.status, 200, await response.clone().text())
    assert.include(response.headers.get('content-type'), 'text/csv')
    const csv = await response.text()
    assert.include(csv, 'Post title')
    assert.include(csv, 'Z MATCH')
    assert.include(csv, 'A MATCH')
    assert.isBelow(csv.indexOf('Z MATCH'), csv.indexOf('A MATCH'))
    assert.notInclude(csv, 'Other')
    assert.notInclude(csv, 'Tenant leak')
  })

  test('exports only selected scoped ids for the bulk variant', async ({ assert }) => {
    const selected = await createPost('Selected')
    const ignored = await createPost('Ignored')
    const response = await exportRequest(fixture, '', { ids: [selected.id, ignored.id] })
    assert.equal(response.status, 200)
    const csv = await response.text()
    assert.include(csv, 'SELECTED')
    assert.include(csv, 'IGNORED')
  })

  test('denies unauthorized exports and enforces the synchronous row limit', async ({ assert }) => {
    await createPost('One')
    denyPolicyAbility('viewAny')
    const denied = await exportRequest(fixture, '')
    assert.equal(denied.status, 403)
    allowPolicyAbilities()
    await createPost('Two')
    const limitedFixture = await createTestApp({
      panels: {
        admin: async () => ({
          default: fixturePanel.resources({
            posts: fixturePostResource.actions({
              header: [actions.export()],
              row: [],
              bulk: [actions.export()],
            }),
            categories: fixtureCategoryResource,
          }),
        }),
      },
      pupitre: { exports: { maxSyncRows: 1 } },
    })
    try {
      const limited = await exportRequest(limitedFixture, '')
      assert.equal(limited.status, 413)
      assert.include(await limited.text(), 'synchronous limit')
    } finally {
      await closeTestApp(limitedFixture)
    }
  })
  test('keeps exports at maxSyncRows synchronous when jobs are configured', async ({ assert }) => {
    const syncJobs = await setupSyncJobsAdapter()
    const panel = fixturePanel.resources({
      posts: fixturePostResource.actions({ header: [actions.export()], row: [], bulk: [] }),
      categories: fixtureCategoryResource,
    })
    const configuredFixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { jobs: syncJobs.adapter, exports: { maxSyncRows: 1 } },
    })
    try {
      await createPost('One synchronous row')
      const response = await exportRequest(configuredFixture, '')
      assert.equal(response.status, 200)
      assert.include(response.headers.get('content-type'), 'text/csv')
      assert.include(await response.text(), 'One synchronous row')
    } finally {
      await closeTestApp(configuredFixture)
      await syncJobs.teardown()
    }
  })
  test('exports only soft-deleted records when trashed=only', async ({ assert }) => {
    const trashedPosts = fixturePostResource
      .softDeletes('deletedAt')
      .table((definition) =>
        definition.columns([table.text('title')]).filters([table.filter.trashed()])
      )
      .actions({ header: [actions.export()], row: [], bulk: [] })
    const softDeleteFixture = await createTestApp({
      panels: {
        admin: async () => ({
          default: fixturePanel.resources({
            posts: trashedPosts,
            categories: fixtureCategoryResource,
          }),
        }),
      },
    })
    try {
      await createPost('Active row')
      await Post.create({
        title: 'Deleted row',
        slug: `deleted-${Math.random()}`,
        status: 'draft',
        tenantId: 1,
        deletedAt: DateTime.now(),
      })
      const response = await exportRequest(softDeleteFixture, '?filters%5Btrashed%5D=only')
      assert.equal(response.status, 200, await response.clone().text())
      const csv = await response.text()
      assert.include(csv, 'Deleted row')
      assert.notInclude(csv, 'Active row')
    } finally {
      await closeTestApp(softDeleteFixture)
    }
  })
  test('queues export, persists lifecycle, downloads CSV, and hides it from another owner', async ({
    assert,
  }) => {
    const syncJobs = await setupSyncJobsAdapter()
    const asyncPanel = fixturePanel.resources({
      posts: fixturePostResource.actions({
        header: [actions.export()],
        row: [],
        bulk: [actions.export()],
      }),
      categories: fixtureCategoryResource,
    })
    const asyncFixture = await createTestApp({
      panels: { admin: async () => ({ default: asyncPanel }) },
      pupitre: { jobs: syncJobs.adapter, exports: { maxSyncRows: 0 } },
    })
    try {
      const owner = await User.create({
        name: 'Export owner',
        email: `export-owner-${Math.random()}@example.test`,
      })
      const other = await User.create({
        name: 'Other owner',
        email: `export-other-${Math.random()}@example.test`,
      })
      const ownerCookie = await asyncFixture.loginAs(owner)
      const otherCookie = await asyncFixture.loginAs(other)
      await createPost('Queued export')
      const response = await fetch(`${asyncFixture.baseUrl}/admin/posts/export?action=export`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Pupitre-Action': '1',
          'Cookie': ownerCookie,
          'Connection': 'close',
        },
        body: JSON.stringify({}),
      })
      assert.equal(response.status, 200)
      const job = exportJobResponse.parse(await response.json())
      const progress = await fetch(`${asyncFixture.baseUrl}${job.progressUrl}`, {
        headers: { Cookie: ownerCookie, Connection: 'close' },
      })
      assert.equal(progress.status, 200)
      const progressData = exportProgressResponse.parse(await progress.json())
      assert.equal(progressData.status, 'done', JSON.stringify(progressData))
      const download = await fetch(`${asyncFixture.baseUrl}${job.downloadUrl}`, {
        headers: { Cookie: ownerCookie, Connection: 'close' },
      })
      assert.equal(download.status, 200)
      assert.include(await download.text(), 'Queued export')
      const forbidden = await fetch(`${asyncFixture.baseUrl}${job.downloadUrl}`, {
        headers: { Cookie: otherCookie, Connection: 'close' },
      })
      assert.equal(forbidden.status, 404)
      const row = await asyncFixture.database.from('pupitre_exports').where('id', job.jobId).first()
      assert.isDefined(row)
      assert.equal(row.status, 'done')
      assert.equal(row.processed_rows, 1)
    } finally {
      await closeTestApp(asyncFixture)
      await syncJobs.teardown()
    }
  })
})
