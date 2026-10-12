import { test } from '@japa/runner'
import { parse } from 'csv-parse/sync'
import { action, actions, exportColumn, schema } from '../../../index.js'
import { pageProps } from '../../../catalog/wire.js'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  fixtureHookEventsSnapshot,
  fixturePanel,
  fixturePostResource,
  Post,
  PostPolicy,
  resetFixtureHooks,
  User,
} from '../../helpers/app.js'
import type { TestApplication } from '../../helpers/app.js'
import { teardown } from '../../helpers/db.js'
import { setupSyncJobsAdapter } from '../../helpers/queue.js'

class UserActionPolicy extends PostPolicy {
  publish(user: User) {
    return user.name === 'Allowed'
  }
}

async function upload(fixture: TestApplication, cookie: string, csv: string) {
  const body = new FormData()
  body.append('file', new File([csv], 'posts.csv', { type: 'text/csv' }))
  body.append('mapping', JSON.stringify({ title: 'title', slug: 'slug' }))
  return fetch(`${fixture.baseUrl}/admin/posts/import?action=import`, {
    method: 'POST',
    headers: { 'X-Pupitre-Action': '1', 'Cookie': cookie, 'Connection': 'close' },
    body,
  })
}

test.group('Compiler, CSV and import audit regressions', (group) => {
  group.teardown(teardown)

  test('cached field actions use the current user and record for URLs, visibility and policy', async ({
    assert,
  }) => {
    const callback = action('inspect').can('publish')
    const visible = action('visible').visible(({ ctx }) => ctx?.pupitre.user?.name === 'Allowed')
    const posts = fixturePostResource
      .policy(UserActionPolicy)
      .form((form) =>
        form.components([
          schema.text('title').prefixAction(callback).suffixAction(visible).hintAction(callback),
        ])
      )
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: fixturePanel.resources({ posts }) }) },
      pupitre: { cache: { dev: true } },
    })
    try {
      allowPolicyAbilities()
      const first = await Post.create({ title: 'A', slug: 'cache-a', status: 'draft', tenantId: 1 })
      const second = await Post.create({
        title: 'B',
        slug: 'cache-b',
        status: 'draft',
        tenantId: 1,
      })
      const user1 = await User.create({
        name: 'Allowed',
        email: `allowed-${Math.random()}@example.test`,
      })
      const user2 = await User.create({
        name: 'Denied',
        email: `denied-${Math.random()}@example.test`,
      })
      const cookies = [await fixture.loginAs(user1), await fixture.loginAs(user2)]
      const results = []
      for (const [index, record] of [first, second].entries()) {
        const response = await fetch(`${fixture.baseUrl}/admin/posts/${record.id}/edit`, {
          headers: {
            'X-Inertia': 'true',
            'X-Inertia-Version': '1',
            'Accept': 'text/html',
            'Cookie': cookies[index]!,
            'Connection': 'close',
          },
        })
        assert.equal(response.status, 200, await response.clone().text())
        const body = (await response.json()) as { props: unknown }
        results.push(pageProps.parse(body.props).page.spec.elements['f.title']!.props)
      }
      for (const key of ['prefixAction', 'suffixAction', 'hintAction']) {
        const firstAction = results[0]![key] as { url: string; enabled: boolean }
        const secondAction = results[1]![key] as { url: string; enabled: boolean }
        assert.include(firstAction.url, `/posts/${first.id}/actions/`)
        assert.include(secondAction.url, `/posts/${second.id}/actions/`)
        assert.isTrue(firstAction.enabled)
        assert.isFalse(secondAction.enabled)
      }
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('import matches create and update hook order and escapes failed rows', async ({
    assert,
  }) => {
    const posts = fixturePostResource.actions({
      header: [
        actions.import().resolveRecord(({ data }) => Post.findBy('slug', String(data.slug))),
      ],
      row: [],
      bulk: [],
    })
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: fixturePanel.resources({ posts }) }) },
    })
    try {
      allowPolicyAbilities()
      await Post.query().delete()
      await Post.create({ title: 'Existing', slug: 'existing', status: 'draft', tenantId: 1 })
      const user = await User.create({
        name: 'Importer',
        email: `audit-import-${Math.random()}@example.test`,
      })
      const cookie = await fixture.loginAs(user)
      resetFixtureHooks()
      const response = await upload(
        fixture,
        cookie,
        'title,slug\nNew,new\nUpdated,existing\n,@unsafe\n'
      )
      assert.equal(response.status, 200, await response.clone().text())
      const result = (await response.json()) as {
        created: number
        updated: number
        failed: number
        failedRowsUrl: string
      }
      assert.equal(result.created, 1)
      assert.equal(result.updated, 1)
      assert.equal(result.failed, 1)
      assert.deepEqual(fixtureHookEventsSnapshot(), [
        'mutateBeforeCreate',
        'mutateBeforeSave',
        'beforeCreate',
        'beforeSave',
        'afterCreate',
        'afterSave',
        'mutateBeforeSave',
        'beforeSave',
        'afterSave',
      ])
      const failed = await fetch(`${fixture.baseUrl}${result.failedRowsUrl}`, {
        headers: { Cookie: cookie, Connection: 'close' },
      })
      assert.equal(failed.status, 200)
      const rows = parse(await failed.text(), { columns: true }) as Record<string, string>[]
      assert.equal(rows[0]?.slug, "'@unsafe")
      // Imports deliberately retain the spreadsheet-safety apostrophe as data.
      const roundTrip = await upload(fixture, cookie, "title,slug\n'=SUM(A1),round-trip\n")
      assert.equal(roundTrip.status, 200)
      const imported = await Post.findByOrFail('slug', 'round-trip')
      assert.equal(imported.title, "'=SUM(A1)")
    } finally {
      resetFixtureHooks()
      await closeTestApp(fixture)
    }
  })

  for (const queued of [false, true]) {
    test(`${queued ? 'queued' : 'synchronous'} export escapes record and formatter formulas`, async ({
      assert,
    }) => {
      const jobs = queued ? await setupSyncJobsAdapter() : undefined
      const posts = fixturePostResource.actions({
        header: [
          actions
            .export()
            .columns([
              exportColumn('title').label('=Title'),
              exportColumn('slug').formatStateUsing(() => '+SUM(A1)'),
              exportColumn('tenantId').formatStateUsing(() => -5),
            ]),
        ],
        row: [],
        bulk: [],
      })
      const fixture = await createTestApp({
        panels: { admin: async () => ({ default: fixturePanel.resources({ posts }) }) },
        ...(jobs ? { pupitre: { jobs: jobs.adapter, exports: { maxSyncRows: 0 } } } : {}),
      })
      try {
        allowPolicyAbilities()
        await Post.query().delete()
        await Post.create({
          title: '=HYPERLINK("https://example.test")',
          slug: 'formula',
          status: 'draft',
          tenantId: 1,
        })
        const user = await User.create({
          name: 'Exporter',
          email: `audit-export-${Math.random()}@example.test`,
        })
        const cookie = await fixture.loginAs(user)
        const response = await fetch(`${fixture.baseUrl}/admin/posts/export?action=export`, {
          method: 'POST',
          headers: {
            'X-Pupitre-Action': '1',
            'Content-Type': 'application/json',
            'Cookie': cookie,
            'Connection': 'close',
          },
          body: '{}',
        })
        assert.equal(response.status, 200, await response.clone().text())
        let csv: string
        if (queued) {
          const job = (await response.json()) as { downloadUrl: string }
          const download = await fetch(`${fixture.baseUrl}${job.downloadUrl}`, {
            headers: { Cookie: cookie, Connection: 'close' },
          })
          assert.equal(download.status, 200, await download.clone().text())
          csv = await download.text()
        } else csv = await response.text()
        const rows = parse(csv) as string[][]
        assert.equal(rows[0]?.[0], "'=Title")
        assert.deepEqual(rows[1], ['\'=HYPERLINK("https://example.test")', "'+SUM(A1)", '-5'])
      } finally {
        await closeTestApp(fixture)
        await jobs?.teardown()
      }
    })
  }
})
