import { truncate } from '../../helpers/db.js'
import { test } from '@japa/runner'
import { ApiClient } from '@japa/api-client'
import { definePanel, definePage, defineWidget, pages, stat, table } from '../../../index.js'
import {
  pageProps,
  tableData as tableDataSchema,
  widgetData as widgetDataSchema,
} from '../../../catalog/wire.js'
import type { TenancyAdapter } from '../../../src/definition/tenancy.js'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  fixturePanel,
  fixturePostResource,
  Post,
} from '../../helpers/app.js'

let observedFilter: unknown
const deferredStats = defineWidget('deferred-stats').stats(async ({ filters }) => {
  observedFilter = filters.status
  return [stat('Status', String(filters.status ?? 'all'))]
})
const deniedWidget = defineWidget('denied-widget')
  .stats(() => [])
  .canView(() => false)
const recentPosts = defineWidget('recent-posts', Post)
  .table((t) =>
    t
      .query((query) => {
        query.where('status', 'draft')
      })
      .columns([
        table.text('title').sortable(),
        table.text('viewsCount').numeric().summarize(['sum', 'count']),
      ])
      .paginated([10, 25])
  )
  .lazy(false)
const recordSummary = defineWidget('edit-summary').stats(({ record }) => [
  stat('Post', String((record as Post | undefined)?.title ?? 'missing')),
])

function testTenantAdapter(): TenancyAdapter {
  return {
    async resolve(ctx) {
      const slug = String(ctx.params.tenant ?? '')
      if (slug !== 'acme' && slug !== 'globex') return null
      return { id: slug === 'acme' ? 1 : 2, name: slug, slug }
    },
    scope(query, tenant) {
      query.where('tenant_id', tenant.id)
    },
    fill(data, tenant) {
      return { ...data, tenantId: tenant.id }
    },
    async listForUser() {
      return [
        { id: 1, name: 'Acme', slug: 'acme' },
        { id: 2, name: 'Globex', slug: 'globex' },
      ]
    },
  }
}

async function inertiaPage(baseUrl: string, path: string, partialData?: string) {
  const request = new ApiClient(baseUrl)
    .get(path)
    .header('Accept', 'text/html')
    .header('X-Inertia', 'true')
    .header('X-Inertia-Version', '1')
  if (partialData) {
    request.header('X-Inertia-Partial-Component', 'pupitre')
    request.header('X-Inertia-Partial-Data', partialData)
  }
  return request.send()
}

test.group('widgets', () => {
  test('validates dashboard widget props and resolves deferred data for only', async ({
    assert,
  }) => {
    observedFilter = undefined
    const panel = fixturePanel
      .widgets([deferredStats, deniedWidget])
      .filters([{ name: 'status', label: 'Status', options: [{ value: 'draft', label: 'Draft' }] }])
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
    })
    try {
      const initial = await inertiaPage(fixture.baseUrl, '/admin?filters%5Bstatus%5D=draft')
      assert.equal(initial.status(), 200, initial.text())
      const props = pageProps.parse(initial.body().props)
      assert.equal(props.page.kind, 'dashboard')
      assert.equal(props.page.widgets?.[0]?.name, 'deferred-stats')
      assert.include(props.page.deferred ?? [], 'widget_dashboard_deferred_stats')
      assert.isUndefined(props.widget_dashboard_deferred_stats)
      assert.notInclude(props.page.widgets?.map((widget) => widget.name) ?? [], 'denied-widget')

      const partial = await inertiaPage(
        fixture.baseUrl,
        '/admin?filters%5Bstatus%5D=draft',
        'widget_dashboard_deferred_stats'
      )
      assert.equal(partial.status(), 200, partial.text())
      const data = widgetDataSchema.parse(partial.body().props.widget_dashboard_deferred_stats)
      assert.equal(data.kind, 'stats')
      assert.equal(observedFilter, 'draft')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('denies hidden widgets and scopes model-backed table queries before sorting', async ({
    assert,
  }) => {
    const panel = definePanel('admin')
      .path('/admin')
      .tenancy({ mode: 'url', adapter: testTenantAdapter() })
      .resources({ posts: fixturePostResource.scope(() => {}) })
      .widgets([deniedWidget, recentPosts])
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
    })
    try {
      await truncate()
      const acmePost = await Post.create({
        title: 'Zebra widget row',
        slug: `acme-widget-z-${Date.now()}`,
        status: 'draft',
        viewsCount: 10,
        tenantId: 1,
      })
      await Post.create({
        title: 'Acme widget row',
        slug: `acme-widget-a-${Date.now()}`,
        status: 'draft',
        viewsCount: 4,
        tenantId: 1,
      })
      await Post.create({
        title: 'Globex widget row',
        slug: `globex-widget-${Date.now()}`,
        status: 'draft',
        viewsCount: 90,
        tenantId: 2,
      })
      const denied = await new ApiClient(fixture.baseUrl)
        .get('/admin/acme/_pupitre/widgets/denied-widget')
        .header('Accept', 'application/json')
        .send()
      assert.equal(denied.status(), 403)

      const tableResponse = await new ApiClient(fixture.baseUrl)
        .get('/admin/acme/_pupitre/widgets/recent-posts?recent-posts%5Bsort%5D=title')
        .header('Accept', 'application/json')
        .send()
      assert.equal(tableResponse.status(), 200, tableResponse.text())
      const data = widgetDataSchema.parse(tableResponse.body())
      if (data.kind !== 'table') throw new Error('Expected table widget data')
      assert.include(JSON.stringify(data.data), acmePost.title)
      assert.notInclude(JSON.stringify(data.data), 'Globex widget row')
      const tableData = tableDataSchema.parse(data.data)
      assert.equal(tableData.rows[0]?.cells.title, 'Acme widget row')
      assert.equal(tableData.rows[1]?.cells.title, 'Zebra widget row')
      assert.deepEqual(tableData.summary?.viewsCount, { sum: '14', count: '2' })
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('record widgets enforce record ability and return 404 across tenants', async ({
    assert,
  }) => {
    allowPolicyAbilities()
    const resource = fixturePostResource.pages({ edit: pages.edit().widgets([recordSummary]) })
    const panel = definePanel('admin')
      .path('/admin')
      .tenancy({ mode: 'url', adapter: testTenantAdapter() })
      .resources({ posts: resource })
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const acmePost = await Post.create({
        title: 'Acme record widget',
        slug: `acme-record-${Date.now()}`,
        status: 'draft',
        tenantId: 1,
      })
      const globexPost = await Post.create({
        title: 'Globex record widget',
        slug: `globex-record-${Date.now()}`,
        status: 'draft',
        tenantId: 2,
      })
      const basePath =
        '/admin/acme/_pupitre/widgets/edit-summary?resource=posts&widgetPage=edit&record='
      const visible = await new ApiClient(fixture.baseUrl)
        .get(`${basePath}${acmePost.id}`)
        .header('Accept', 'application/json')
        .send()
      assert.equal(visible.status(), 200, visible.text())
      assert.include(JSON.stringify(widgetDataSchema.parse(visible.body())), acmePost.title)
      const documentedContext = await new ApiClient(fixture.baseUrl)
        .get(`/admin/acme/_pupitre/widgets/edit-summary?resource=posts&record=${acmePost.id}`)
        .header('Accept', 'application/json')
        .send()
      assert.equal(documentedContext.status(), 404, documentedContext.text())

      denyPolicyAbility('update')
      const denied = await new ApiClient(fixture.baseUrl)
        .get(`${basePath}${acmePost.id}`)
        .header('Accept', 'application/json')
        .send()
      assert.equal(denied.status(), 403)
      const missingPage = await new ApiClient(fixture.baseUrl)
        .get(`/admin/acme/_pupitre/widgets/edit-summary?resource=posts&record=${acmePost.id}`)
        .header('Accept', 'application/json')
        .send()
      assert.equal(missingPage.status(), 404)
      allowPolicyAbilities()

      const crossTenant = await new ApiClient(fixture.baseUrl)
        .get(`${basePath}${globexPost.id}`)
        .header('Accept', 'application/json')
        .send()
      assert.equal(crossTenant.status(), 404)
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })

  test('custom pages expose widgets and filter descriptors through the page grid contract', async ({
    assert,
  }) => {
    const page = definePage('reports')
      .path('/reports')
      .title('Reports')
      .widgets([deferredStats])
      .filters([{ name: 'status', label: 'Status', options: [{ value: 'draft', label: 'Draft' }] }])
    const panel = fixturePanel.pages([page])
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
    })
    try {
      const response = await inertiaPage(fixture.baseUrl, '/admin/reports')
      assert.equal(response.status(), 200, response.text())
      const props = pageProps.parse(response.body().props)
      assert.equal(props.page.title, 'Reports')
      assert.equal(props.page.widgets?.[0]?.name, 'deferred-stats')
      assert.equal(props.page.filters?.[0]?.name, 'status')
    } finally {
      await closeTestApp(fixture)
    }
  })
})
