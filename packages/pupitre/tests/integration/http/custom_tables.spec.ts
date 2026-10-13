import { test } from '@japa/runner'
import { ApiClient } from '@japa/api-client'
import { Bouncer } from '@adonisjs/bouncer'
import {
  action,
  definePanel,
  definePage,
  defineWidget,
  pages,
  schema,
  table,
} from '../../../index.js'
import {
  createTestApp,
  closeTestApp,
  fixturePostResource,
  Post,
  PostPolicy,
  allowPolicyAbilities,
  denyPolicyAbility,
} from '../../helpers/app.js'
import type { TenancyAdapter } from '../../../src/definition/tenancy.js'
import type { TableSchema } from '../../../src/definition/table.js'

class PageInspectPolicy extends PostPolicy {
  inspect() {
    return true
  }
}

const tenancy: TenancyAdapter = {
  async resolve(ctx) {
    const slug = ctx.params.tenant
    return slug === 'acme' || slug === 'globex'
      ? { id: slug === 'acme' ? 1 : 2, name: slug, slug }
      : null
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
const dataset = [
  { id: 'a', title: 'Alpha', region: 'east', tenant: 1 },
  { id: 'b', title: 'Beta', region: 'west', tenant: 1 },
  { id: 'c', title: 'Gamma', region: 'east', tenant: 1 },
  { id: 'foreign', title: 'Foreign', region: 'east', tenant: 2 },
]

test.group('custom tables and component widgets', () => {
  test('component loader forwards query and record; action validates, authorizes and scopes tenants', async ({
    assert,
  }) => {
    allowPolicyAbilities()
    const component = defineWidget('component')
      .component('Demo', ({ filters, record }) => ({
        range: filters.range,
        title: record instanceof Post ? record.title : null,
      }))
      .actions([
        action('change')
          .can('delete')
          .form([schema.text('title').required()])
          .handle(({ data, notify }) => notify?.success(String(data?.title)).send()),
      ])
    const recordTable = defineWidget('record-rows')
      .lazy(false)
      .table((builder) =>
        builder
          .columns([table.text('title')])
          .records(({ record }) => ({
            rows: record instanceof Post ? [{ id: 'row', title: record.title }] : [],
            total: 1,
          }))
          .resolveRecord(() => ({ id: 'row', title: 'Resolved' }))
          .actions({
            row: [
              action('inspect')
                .form([schema.text('title').readOnly()])
                .fillForm(({ record }) => ({
                  title: record && typeof record === 'object' ? Reflect.get(record, 'title') : '',
                })),
            ],
          })
      )
    const resource = fixturePostResource.pages({
      edit: pages.edit().widgets([component, recordTable]),
    })
    const panel = definePanel('admin')
      .path('/admin')
      .middleware([
        async (ctx, next) => {
          // The host permits delete even when the resource policy denies it.
          const bouncer = new Bouncer(
            { id: 1 },
            { delete: Bouncer.ability(() => true) }
          ).setContainerResolver(ctx.containerResolver)
          Object.defineProperty(ctx, 'bouncer', { value: bouncer, configurable: true })
          return next()
        },
      ])
      .tenancy({ mode: 'url', adapter: tenancy })
      .resources({ posts: resource })
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const post = await Post.create({
        title: 'Owned',
        slug: 'owned-widget',
        status: 'draft',
        tenantId: 1,
      })
      const initial = await new ApiClient(fixture.baseUrl)
        .get(`/admin/acme/posts/${post.id}/edit`)
        .header('Accept', 'text/html')
        .header('X-Inertia', 'true')
        .header('X-Inertia-Version', '1')
        .send()
      assert.equal(initial.status(), 200, initial.text())
      const tableRow = initial.body().props.widget_header_record_rows.data.rows[0]
      assert.equal(tableRow.cells.title, 'Owned')
      assert.include(tableRow.actions[0].url, 'widgetPage=edit')
      const recordForm = await new ApiClient(fixture.baseUrl)
        .get(tableRow.actions[0].url)
        .header('Accept', 'application/json')
        .send()
      assert.equal(recordForm.status(), 200, recordForm.text())
      assert.equal(recordForm.body().state.data.title, 'Resolved')
      const foreign = await Post.create({
        title: 'Foreign',
        slug: 'foreign-widget',
        status: 'draft',
        tenantId: 2,
      })
      const context = `?resource=posts&widgetPage=edit&record=${post.id}&range=week&filters[status]=draft`
      const base = '/admin/acme/_pupitre/widgets/component'
      const loaded = await new ApiClient(fixture.baseUrl).get(base + context).send()
      assert.equal(loaded.status(), 200, loaded.text())
      assert.deepEqual(loaded.body().data, { range: 'week', title: 'Owned' })
      const invalid = await new ApiClient(fixture.baseUrl)
        .post(base + '/actions/change' + context)
        .header('X-Pupitre-Action', '1')
        .json({ data: {} })
        .send()
      assert.equal(invalid.status(), 422, invalid.text())
      assert.property(invalid.body().errors, 'title')
      const valid = await new ApiClient(fixture.baseUrl)
        .post(base + '/actions/change' + context)
        .header('X-Pupitre-Action', '1')
        .json({ data: { title: 'Changed' } })
        .send()
      assert.equal(valid.status(), 200, valid.text())
      assert.equal(valid.body().flash[0].title, 'Changed')
      const unknownGroup = await new ApiClient(fixture.baseUrl)
        .post(base + '/actions/change' + context + '&tableAction=x')
        .header('Accept', 'application/json')
        .json({ data: { title: 'Changed' } })
        .send()
      assert.equal(unknownGroup.status(), 404, unknownGroup.text())
      denyPolicyAbility('delete')
      const denied = await new ApiClient(fixture.baseUrl)
        .post(base + '/actions/change' + context)
        .json({ data: { title: 'Bad' } })
        .header('Accept', 'application/json')
        .send()
      assert.equal(denied.status(), 403)
      const cannotSwitchAuthority = await new ApiClient(fixture.baseUrl)
        .post(base + '/actions/change' + context + '&tableAction=x')
        .json({ data: { title: 'Bad' } })
        .header('Accept', 'application/json')
        .send()
      assert.equal(cannotSwitchAuthority.status(), 404, cannotSwitchAuthority.text())
      allowPolicyAbilities()
      const crossTenant = await new ApiClient(fixture.baseUrl)
        .post(base + `/actions/change?resource=posts&widgetPage=edit&record=${foreign.id}`)
        .json({ data: { title: 'Bad' } })
        .header('Accept', 'application/json')
        .send()
      assert.equal(crossTenant.status(), 404)
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })

  test('resource-context custom table actions authorize resolved rows rather than the page record', async ({
    assert,
  }) => {
    allowPolicyAbilities()
    let calls = 0
    const rows = [
      { id: 'allowed', title: 'Allowed' },
      { id: 'denied', title: 'Denied' },
    ]
    const guarded = defineWidget('guarded')
      .lazy(false)
      .table((builder) =>
        builder
          .columns([table.text('title')])
          .records(() => ({ rows }))
          .resolveRecord((key) => rows.find((row) => row.id === key) ?? null)
          .actions({
            header: [
              action('inspect-header')
                .can('headerInspect')
                .handle(() => {
                  calls++
                }),
            ],
            row: [
              action('inspect')
                .can('inspect')
                .handle(() => {
                  calls++
                }),
            ],
            bulk: [
              action('inspect-many')
                .can('inspect')
                .handle(() => {
                  calls++
                }),
            ],
          })
      )
    const panel = definePanel('admin')
      .middleware([
        async (ctx, next) => {
          const bouncer = new Bouncer(
            { id: 1 },
            {
              headerInspect: Bouncer.ability((_user, row?: unknown) => row === undefined),
              inspect: Bouncer.ability(
                (_user, row?: Record<string, unknown>) => row?.id === 'allowed'
              ),
            }
          ).setContainerResolver(ctx.containerResolver)
          Object.defineProperty(ctx, 'bouncer', { value: bouncer, configurable: true })
          return next()
        },
      ])
      .resources({
        posts: fixturePostResource
          .policy(PageInspectPolicy)
          .pages({ edit: pages.edit().widgets([guarded]) }),
      })
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const post = await Post.create({
        title: 'Page',
        slug: 'page-row-auth',
        status: 'draft',
        tenantId: 1,
      })
      const context = `resource=posts&widgetPage=edit&record=${post.id}`
      const base = '/admin/_pupitre/widgets/guarded'
      const loaded = await new ApiClient(fixture.baseUrl).get(`${base}?${context}`).send()
      assert.equal(loaded.status(), 200, loaded.text())
      assert.isTrue(loaded.body().data.rows[0].actions[0].enabled)
      assert.isFalse(loaded.body().data.rows[1].actions[0].enabled)
      for (const [key, status] of [
        ['denied', 403],
        ['allowed', 200],
      ] as const) {
        const response = await new ApiClient(fixture.baseUrl)
          .post(`${base}/actions/inspect?${context}&tableAction=row&rowKey=${key}`)
          .header('Accept', 'application/json')
          .json({ data: {} })
          .send()
        assert.equal(response.status(), status, response.text())
      }
      const header = await new ApiClient(fixture.baseUrl)
        .post(`${base}/actions/inspect-header?${context}&tableAction=header`)
        .header('Accept', 'application/json')
        .json({ data: {} })
        .send()
      assert.equal(header.status(), 200, header.text())
      const bulk = await new ApiClient(fixture.baseUrl)
        .post(`${base}/actions/inspect-many?${context}&tableAction=bulk`)
        .header('Accept', 'application/json')
        .json({ ids: ['allowed', 'denied'], data: {} })
        .send()
      assert.equal(bulk.status(), 403, bulk.text())
      assert.equal(calls, 2)
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('custom tables validate URL state, simple pagination and server-side action lookup', async ({
    assert,
  }) => {
    let observed: unknown
    let handled: unknown
    const currencies = defineWidget('currencies')
      .table((t) =>
        t
          .columns([table.text('title').searchable().sortable(), table.text('region')])
          .filters([table.filter.select('region').options({ east: 'East', west: 'West' })])
          .paginated([2])
          .records((args) => {
            observed = {
              search: args.search,
              filters: args.filters,
              sort: args.sort,
              page: args.page,
              perPage: args.perPage,
            }
            const rows = dataset.filter(
              (row) =>
                row.tenant === args.ctx.pupitre.tenant?.id &&
                row.title.toLowerCase().includes(args.search.toLowerCase()) &&
                (!args.filters.region || row.region === args.filters.region)
            )
            if (args.sort[0]?.direction === 'desc') rows.reverse()
            return { rows: rows.slice((args.page - 1) * 2, args.page * 2 + 1) }
          })
          .resolveRecord(
            (key, ctx) =>
              dataset.find((row) => row.id === key && row.tenant === ctx.pupitre.tenant?.id) ?? null
          )
          .actions({
            header: [action('refresh').handle(({ notify }) => notify?.success('Refreshed').send())],
            bulk: [
              action('inspect-many')
                .form([schema.text('note').required()])
                .handle(({ records }) => {
                  handled = records
                }),
            ],
            row: [
              action('inspect')
                .can('inspect')
                .form([schema.text('note').required()])
                .handle(({ record }) => {
                  handled = record
                }),
            ],
          })
      )
      .lazy(false)
    const page = definePage('currencies').widgets([currencies])
    const panel = definePanel('admin')
      .path('/admin')
      .middleware([
        async (ctx, next) => {
          const bouncer = new Bouncer(
            { id: 1 },
            {
              inspect: Bouncer.ability((_user, row?: Record<string, unknown>) => row?.id === 'a'),
            }
          ).setContainerResolver(ctx.containerResolver)
          Object.defineProperty(ctx, 'bouncer', { value: bouncer, configurable: true })
          return next()
        },
      ])
      .tenancy({ mode: 'url', adapter: tenancy })
      .pages({ currencies: page })
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const base = '/admin/acme/_pupitre/widgets/currencies?customPage=currencies'
      const response = await new ApiClient(fixture.baseUrl)
        .get(base + '&currencies[q]=a&currencies[sort]=-title&currencies[filters][region]=east')
        .send()
      assert.equal(response.status(), 200, response.text())
      assert.deepEqual(observed, {
        search: 'a',
        filters: { region: 'east' },
        sort: [{ column: 'title', direction: 'desc' }],
        page: 1,
        perPage: 2,
      })
      assert.deepEqual(
        response.body().data.rows.map((row: { key: string }) => row.key),
        ['c', 'a']
      )
      const simple = await new ApiClient(fixture.baseUrl).get(base).send()
      assert.equal(simple.status(), 200, simple.text())
      assert.isTrue(simple.body().data.meta.simple)
      assert.isTrue(simple.body().data.meta.hasNext)
      assert.lengthOf(simple.body().data.rows, 2)
      const next = await new ApiClient(fixture.baseUrl).get(base + '&currencies[page]=2').send()
      assert.isFalse(next.body().data.meta.hasNext)
      const badSort = await new ApiClient(fixture.baseUrl)
        .get(base + '&currencies[sort]=region')
        .send()
      assert.equal(badSort.status(), 400)
      const badFilter = await new ApiClient(fixture.baseUrl)
        .get(base + '&currencies[filters][region]=unknown')
        .header('Accept', 'application/json')
        .send()
      assert.equal(badFilter.status(), 422)
      const actionUrl = simple.body().data.rows[0].actions[0].url
      const run = await new ApiClient(fixture.baseUrl)
        .post(actionUrl)
        .header('X-Pupitre-Action', '1')
        .json({ data: { note: 'Test', record: dataset[3] } })
        .send()
      assert.equal(run.status(), 200, run.text())
      assert.deepEqual(handled, dataset[0])
      const forbiddenRow = await new ApiClient(fixture.baseUrl)
        .post(actionUrl.replace('rowKey=a', 'rowKey=b'))
        .header('Accept', 'application/json')
        .json({ data: { note: 'Test' } })
        .send()
      assert.equal(forbiddenRow.status(), 403, forbiddenRow.text())
      const missingUrl = actionUrl.replace('rowKey=a', 'rowKey=foreign')
      const missing = await new ApiClient(fixture.baseUrl)
        .post(missingUrl)
        .json({ data: { note: 'Test' } })
        .header('Accept', 'application/json')
        .send()
      assert.equal(missing.status(), 404)
      const bulkUrl =
        '/admin/acme/_pupitre/widgets/currencies/actions/inspect-many?customPage=currencies&tableAction=bulk'
      const bulkForm = await new ApiClient(fixture.baseUrl)
        .get(bulkUrl)
        .header('Accept', 'application/json')
        .send()
      assert.equal(bulkForm.status(), 200, bulkForm.text())
      const bulk = await new ApiClient(fixture.baseUrl)
        .post(bulkUrl)
        .header('X-Pupitre-Action', '1')
        .json({ ids: ['a', 'b'], data: { note: 'Batch' } })
        .send()
      assert.equal(bulk.status(), 200, bulk.text())
      assert.deepEqual(handled, [dataset[0], dataset[1]])
      handled = undefined
      const foreignBulk = await new ApiClient(fixture.baseUrl)
        .post(bulkUrl)
        .header('Accept', 'application/json')
        .json({ ids: ['a', 'foreign'], data: { note: 'Batch' } })
        .send()
      assert.equal(foreignBulk.status(), 404, foreignBulk.text())
      assert.isUndefined(handled)
      const header = await new ApiClient(fixture.baseUrl)
        .post(
          '/admin/acme/_pupitre/widgets/currencies/actions/refresh?customPage=currencies&tableAction=header'
        )
        .header('X-Pupitre-Action', '1')
        .json({ data: {} })
        .send()
      assert.equal(header.status(), 200, header.text())
      assert.equal(header.body().flash[0].title, 'Refreshed')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('hidden widgets deny custom records and actions before callbacks run', async ({
    assert,
  }) => {
    let calls = 0
    const hidden = defineWidget('hidden')
      .component('Demo', () => {
        calls++
        return {}
      })
      .canView(() => false)
      .actions([
        action('run').handle(() => {
          calls++
        }),
      ])
    const panel = definePanel('admin').path('/admin').widgets([hidden])
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const deniedData = await new ApiClient(fixture.baseUrl)
        .get('/admin/_pupitre/widgets/hidden')
        .header('Accept', 'application/json')
        .send()
      assert.equal(deniedData.status(), 403)
      const deniedAction = await new ApiClient(fixture.baseUrl)
        .post('/admin/_pupitre/widgets/hidden/actions/run')
        .json({ data: {} })
        .header('Accept', 'application/json')
        .send()
      assert.equal(deniedAction.status(), 403)
      assert.equal(calls, 0)
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('rejects Lucid-only features independent of builder order', ({ assert }) => {
    const loaders = () => ({ rows: [] })
    for (const configure of [
      (t: TableSchema) => t.columns([table.text('relation.title')]),
      (t: TableSchema) => t.columns([table.text('amount').summarize(['sum'])]),
      (t: TableSchema) => t.columns([table.toggle('active')]),
      (t: TableSchema) => t.reorderable('position'),
      (t: TableSchema) => t.filters([table.filter.queryBuilder()]),
      (t: TableSchema) => t.query(() => {}),
    ]) {
      assert.throws(
        () => defineWidget('bad').table((t) => configure(t.records(loaders))),
        'Lucid-only'
      )
      assert.throws(
        () => defineWidget('bad').table((t) => configure(t).records(loaders)),
        'Lucid-only'
      )
    }
  })
})
