import { test } from '@japa/runner'
import { action, actions } from '../../../index.js'
import { exportJobResponse } from '../../../catalog/wire.js'
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
import type { JobsAdapter } from '../../../src/adapters/jobs.js'
import { setupSyncJobsAdapter } from '../../helpers/queue.js'
import { teardown } from '../../helpers/db.js'

test.group('Header action and queued export authorization', (group) => {
  let fixture: TestApplication
  let cookie: string
  let jobs: { adapter: JobsAdapter; teardown(): Promise<void> }
  let handled = 0

  group.setup(async () => {
    jobs = await setupSyncJobsAdapter()
    const posts = fixturePostResource.actions({
      header: [
        actions.create(),
        action('custom-header').handle(() => {
          handled++
        }),
        actions.export().can('publish'),
      ],
      row: [],
      bulk: [],
    })
    fixture = await createTestApp({
      panels: { admin: async () => ({ default: fixturePanel.resources({ posts }) }) },
      pupitre: { jobs: jobs.adapter, exports: { maxSyncRows: 0 } },
    })
    const owner = await User.create({
      name: 'Authorization owner',
      email: `authorization-${Math.random()}@example.test`,
    })
    cookie = await fixture.loginAs(owner)
  })
  group.teardown(async () => {
    allowPolicyAbilities()
    await closeTestApp(fixture)
    await jobs.teardown()
    await teardown()
  })
  group.each.setup(async () => {
    allowPolicyAbilities()
    handled = 0
    await Post.query().delete()
  })

  test('denies a custom header handler without viewAny and preserves allowed execution', async ({
    assert,
  }) => {
    const run = () =>
      fetch(`${fixture.baseUrl}/admin/posts/actions/custom-header`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Pupitre-Action': '1',
          'Cookie': cookie,
          'Connection': 'close',
        },
        body: JSON.stringify({ data: {} }),
      })
    denyPolicyAbility('viewAny')
    const denied = await run()
    assert.equal(denied.status, 403)
    assert.equal(handled, 0)
    allowPolicyAbilities()
    const allowed = await run()
    assert.equal(allowed.status, 200, await allowed.text())
    assert.equal(handled, 1)
  })

  test('requires viewAny for create header submissions even when create is allowed', async ({
    assert,
  }) => {
    denyPolicyAbility('viewAny')
    const response = await fetch(`${fixture.baseUrl}/admin/posts/actions/create`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Pupitre-Action': '1',
        'Cookie': cookie,
        'Connection': 'close',
      },
      body: JSON.stringify({ data: { title: 'Denied', slug: 'denied', status: 'draft' } }),
    })
    assert.equal(response.status, 403)
    assert.lengthOf(await Post.all(), 0)
  })

  test('rechecks the current export grant on progress and download after completion', async ({
    assert,
  }) => {
    await Post.create({
      title: 'Protected export',
      slug: 'protected-export',
      status: 'draft',
      tenantId: 1,
    })
    const response = await fetch(`${fixture.baseUrl}/admin/posts/export?action=export`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Pupitre-Action': '1',
        'Cookie': cookie,
        'Connection': 'close',
      },
      body: JSON.stringify({}),
    })
    assert.equal(response.status, 200, await response.clone().text())
    const job = exportJobResponse.parse(await response.json())
    const row = await fixture.database.from('pupitre_exports').where('id', job.jobId).first()
    assert.equal(row.status, 'done')
    assert.deepEqual(JSON.parse(row.result), { action: 'export' })
    const download = await fetch(`${fixture.baseUrl}${job.downloadUrl}`, {
      headers: { Cookie: cookie, Connection: 'close' },
    })
    assert.equal(download.status, 200)
    assert.include(await download.text(), 'Protected export')

    denyPolicyAbility('publish')
    for (const url of [job.progressUrl, job.downloadUrl]) {
      const denied = await fetch(`${fixture.baseUrl}${url}`, {
        headers: { Cookie: cookie, Connection: 'close' },
      })
      assert.equal(denied.status, 403, await denied.text())
    }
    allowPolicyAbilities()
    for (const result of [JSON.stringify({ action: 'removed-action' }), null, '{invalid']) {
      await fixture.database.from('pupitre_exports').where('id', job.jobId).update({ result })
      for (const url of [job.progressUrl, job.downloadUrl]) {
        const denied = await fetch(`${fixture.baseUrl}${url}`, {
          headers: { Cookie: cookie, Connection: 'close' },
        })
        assert.equal(denied.status, 403, await denied.text())
      }
    }
  })
})
