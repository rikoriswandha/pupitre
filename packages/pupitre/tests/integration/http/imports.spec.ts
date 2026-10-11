import { test } from '@japa/runner'
import { exportProgressResponse, importJobResponse } from '../../../catalog/wire.js'
import { setupSyncJobsAdapter } from '../../helpers/queue.js'
import { actions } from '../../../index.js'
import {
  closeTestApp,
  createTestApp,
  fixtureCategoryResource,
  fixturePanel,
  fixturePostResource,
  Post,
} from '../../helpers/app.js'
import type { TestApplication } from '../../helpers/app.js'
import User from '../../fixtures/models/user.js'
import { teardown } from '../../helpers/db.js'

async function uploadImport(
  fixture: TestApplication,
  cookie: string,
  csv: string,
  mapping: Record<string, string>
) {
  const body = new FormData()
  body.append('file', new File([csv], 'posts.csv', { type: 'text/csv' }))
  body.append('mapping', JSON.stringify(mapping))
  return fetch(`${fixture.baseUrl}/admin/posts/import?action=import`, {
    method: 'POST',
    headers: {
      'X-Pupitre-Action': '1',
      'Cookie': cookie,
      'Connection': 'close',
    },
    body,
  })
}

test.group('Pupitre CSV imports', (group) => {
  let fixture: TestApplication
  group.setup(async () => {
    const importAction = actions
      .import()
      .resolveRecord(({ data }) => Post.findBy('slug', String(data.slug)))
    const posts = fixturePostResource.actions({
      header: [importAction],
      row: [],
      bulk: [],
    })
    const panel = fixturePanel.resources({ posts, categories: fixtureCategoryResource })
    fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
  })
  group.each.setup(async () => {
    await Post.query().delete()
  })
  group.teardown(async () => {
    await closeTestApp(fixture)
    await teardown()
  })

  test('validates rows, upserts records, and downloads failed CSV', async ({ assert }) => {
    const existing = await Post.create({
      title: 'Before import',
      slug: 'existing-row',
      status: 'draft',
      tenantId: 1,
    })
    const user = await User.create({
      name: 'Import user',
      email: `import-${Math.random()}@example.test`,
    })
    const cookie = await fixture.loginAs(user)
    const invalidTitle = ''
    const response = await uploadImport(
      fixture,
      cookie,
      `title,slug,skip\nNew record,new-record,ignored\nUpdated record,existing-row,ignored\n${invalidTitle},invalid-row,ignored\n`,
      { title: 'title', slug: 'slug', skip: '' }
    )
    assert.equal(response.status, 200, await response.clone().text())
    const summary = (await response.json()) as {
      total: number
      created: number
      updated: number
      failed: number
      failedRowsUrl?: string
    }
    const failedRows = await fetch(`${fixture.baseUrl}${summary.failedRowsUrl}`, {
      headers: { Cookie: cookie, Connection: 'close' },
    })
    const failureCsv = await failedRows.text()
    assert.equal(summary.total, 3)
    assert.equal(summary.created, 1, failureCsv)
    assert.equal(summary.updated, 1, failureCsv)
    assert.equal(summary.failed, 1, failureCsv)
    const importedExisting = await Post.findOrFail(existing.id)
    assert.equal(importedExisting.title, 'Updated record')
    const createdPost = await Post.findBy('slug', 'new-record')
    assert.isNotNull(createdPost)
    assert.equal(createdPost?.tenantId, 1)

    assert.isString(summary.failedRowsUrl)
    assert.include(failureCsv, 'Errors')
    assert.include(failureCsv, 'invalid-row')
  })
  test('queues async imports and reports progress', async ({ assert }) => {
    const syncJobs = await setupSyncJobsAdapter()
    const importAction = actions
      .import()
      .async()
      .resolveRecord(({ data }) => Post.findBy('slug', String(data.slug)))
    const panel = fixturePanel.resources({
      posts: fixturePostResource.actions({ header: [importAction], row: [], bulk: [] }),
      categories: fixtureCategoryResource,
    })
    const asyncFixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { jobs: syncJobs.adapter },
    })
    try {
      const user = await User.create({
        name: 'Async import user',
        email: `async-import-${Math.random()}@example.test`,
      })
      const cookie = await asyncFixture.loginAs(user)
      const response = await uploadImport(
        asyncFixture,
        cookie,
        `title,slug
Queued import,queued-import
`,
        { title: 'title', slug: 'slug' }
      )
      assert.equal(response.status, 200, await response.clone().text())
      const payload = await response.json()
      assert.property(payload, 'jobId', JSON.stringify(payload))
      const job = importJobResponse.parse(payload)
      const progressResponse = await fetch(`${asyncFixture.baseUrl}${job.progressUrl}`, {
        headers: { Cookie: cookie, Connection: 'close' },
      })
      const progress = exportProgressResponse.parse(await progressResponse.json())
      assert.equal(progress.status, 'done', JSON.stringify(progress))
      assert.equal(progress.createdRows, 1)
      assert.equal(progress.failedRows, 0)
      assert.isNotNull(await Post.findBy('slug', 'queued-import'))
    } finally {
      await closeTestApp(asyncFixture)
      await syncJobs.teardown()
    }
  })
})
