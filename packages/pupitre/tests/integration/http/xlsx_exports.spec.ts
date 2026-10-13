import { test } from '@japa/runner'
import { actions, exportColumn, t } from '../../../index.js'
import { setupSyncJobsAdapter } from '../../helpers/queue.js'
import { readXlsx } from '../../helpers/xlsx.js'
import {
  allowPolicyAbilities,
  denyPolicyAbility,
  closeTestApp,
  createTestApp,
  fixturePanel,
  fixturePostResource,
  Post,
  User,
} from '../../helpers/app.js'
import { teardown } from '../../helpers/db.js'
import { xlsxContentType } from '../../../src/table/xlsx_stream.js'

test.group('XLSX export HTTP lifecycle', (group) => {
  group.teardown(async () => {
    await teardown()
  })
  for (const asyncExport of [false, true]) {
    test(`${asyncExport ? 'queued' : 'synchronous'} XLSX localizes headers and preserves authorization and scope`, async ({
      assert,
    }) => {
      const jobs = await setupSyncJobsAdapter()
      const fixture = await createTestApp({
        panels: {
          admin: async () => ({
            default: fixturePanel.locales(['en', 'id']).resources({
              posts: fixturePostResource.actions({
                header: [
                  actions
                    .export()
                    .formats(['csv', 'xlsx'])
                    .columns([exportColumn('title').label(t('Post title'))]),
                ],
                row: [],
                bulk: [],
              }),
            }),
          }),
        },
        pupitre: {
          ...(asyncExport ? { jobs: jobs.adapter } : {}),
          exports: { maxSyncRows: asyncExport ? 0 : 1000 },
          i18n: { messages: { id: { 'Post title': 'Judul artikel' } } },
        },
      })
      try {
        allowPolicyAbilities()
        await Post.query().delete()
        await Post.create({
          title: 'Visible & safe',
          slug: `visible-${Math.random()}`,
          status: 'draft',
          tenantId: 1,
        })
        const foreign = await Post.create({
          title: 'Tenant secret',
          slug: `secret-${Math.random()}`,
          status: 'draft',
          tenantId: 2,
        })
        const owner = await User.create({
          name: 'XLSX owner',
          email: `xlsx-owner-${Math.random()}@test.dev`,
        })
        const other = await User.create({
          name: 'Other owner',
          email: `xlsx-other-${Math.random()}@test.dev`,
        })
        const cookie = await fixture.loginAs(owner)
        const otherCookie = await fixture.loginAs(other)
        const request = (body: unknown) =>
          fetch(`${fixture.baseUrl}/admin/posts/export?action=export`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': cookie,
              'Accept-Language': 'id',
              'Connection': 'close',
            },
            body: JSON.stringify(body),
          })
        denyPolicyAbility('viewAny')
        const denied = await request({ format: 'xlsx' })
        assert.equal(denied.status, 403)
        allowPolicyAbilities()
        const invalid = await request({ format: 'pdf' })
        assert.equal(invalid.status, 422)
        const foreignResponse = await request({ format: 'xlsx', ids: [foreign.id] })
        assert.notEqual(foreignResponse.status, 200)
        let response = await request({ format: 'xlsx' })
        assert.equal(response.status, 200, await response.clone().text())
        if (asyncExport) {
          const job = (await response.json()) as {
            jobId: string
            downloadUrl: string
            progressUrl: string
          }
          const row = await fixture.database.from('pupitre_exports').where('id', job.jobId).first()
          assert.equal(row.status, 'done')
          assert.equal(JSON.parse(row.result).format, 'xlsx')
          assert.match(row.file_key, /\.xlsx$/)
          assert.isNotNull(row.expires_at)
          const otherDownload = await fetch(`${fixture.baseUrl}${job.downloadUrl}`, {
            headers: { Cookie: otherCookie, Connection: 'close' },
          })
          assert.equal(otherDownload.status, 404)
          await fixture.database
            .from('pupitre_exports')
            .where('id', job.jobId)
            .update({ tenant_id: '2' })
          const otherTenantDownload = await fetch(`${fixture.baseUrl}${job.downloadUrl}`, {
            headers: { Cookie: cookie, Connection: 'close' },
          })
          assert.equal(otherTenantDownload.status, 404)
          await fixture.database
            .from('pupitre_exports')
            .where('id', job.jobId)
            .update({ tenant_id: row.tenant_id })
          denyPolicyAbility('viewAny')
          const unauthorizedDownload = await fetch(`${fixture.baseUrl}${job.downloadUrl}`, {
            headers: { Cookie: cookie, Connection: 'close' },
          })
          assert.notEqual(unauthorizedDownload.status, 200)
          allowPolicyAbilities()
          response = await fetch(`${fixture.baseUrl}${job.downloadUrl}`, {
            headers: { Cookie: cookie, Connection: 'close' },
          })
          assert.equal(response.status, 200)
        }
        assert.equal(response.headers.get('content-type'), xlsxContentType)
        assert.match(response.headers.get('content-disposition')!, /\.xlsx"$/)
        const sheet = readXlsx(Buffer.from(await response.arrayBuffer()))[
          'xl/worksheets/sheet1.xml'
        ]!
        assert.include(sheet, 'Judul artikel')
        assert.include(sheet, 'Visible &amp; safe')
        assert.notInclude(sheet, 'Tenant secret')
      } finally {
        allowPolicyAbilities()
        await closeTestApp(fixture)
        await jobs.teardown()
      }
    })
  }
  test('rejects XLSX when the action only permits CSV', async ({ assert }) => {
    const fixture = await createTestApp({
      panels: {
        admin: async () => ({
          default: fixturePanel.resources({
            posts: fixturePostResource.actions({ header: [actions.export()], row: [], bulk: [] }),
          }),
        }),
      },
    })
    try {
      allowPolicyAbilities()
      const response = await fetch(`${fixture.baseUrl}/admin/posts/export?action=export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Connection': 'close' },
        body: JSON.stringify({ format: 'xlsx' }),
      })
      assert.equal(response.status, 422)
    } finally {
      await closeTestApp(fixture)
    }
  })
})
