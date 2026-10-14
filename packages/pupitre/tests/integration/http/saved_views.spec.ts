import { test } from '@japa/runner'
import { definePanel, defineRelationManager, table, tableView } from '../../../index.js'
import {
  closeTestApp,
  createTestApp,
  fixturePostResource,
  fixtureCategoryResource,
  PostPolicy,
  Post,
  User,
  Category,
  denyPolicyAbility,
  allowPolicyAbilities,
} from '../../helpers/app.js'
import { testSessionAuthentication } from '../../helpers/app.js'
import type { TestApplication } from '../../helpers/app.js'
import type { TenancyAdapter } from '../../../src/definition/tenancy.js'

class ViewsPolicy extends PostPolicy {
  managePublicViews(user: User) {
    return user.email === 'views-admin@example.test'
  }
}
function viewsTable(t: Parameters<Parameters<typeof fixturePostResource.table>[0]>[0]) {
  return t
    .savedViews()
    .presetViews([
      tableView('Drafts')
        .query({ filters: { status: 'draft' } })
        .default(),
    ])
    .columns([
      table.text('title').sortable().searchable({ individually: true }),
      table.text('status').toggleable(),
    ])
    .filters([table.filter.select('status').options({ draft: 'Draft', published: 'Published' })])
    .paginated([10, 25])
}
async function setup(withPolicy = true) {
  const posts = fixturePostResource
    .policy(withPolicy ? ViewsPolicy : PostPolicy)
    .scope(() => {})
    .table(viewsTable)
    .relations([
      defineRelationManager(Post, 'category').table((t) =>
        t.savedViews().columns([table.text('name').searchable().sortable()])
      ),
    ])
  const adapter: TenancyAdapter = {
    async resolve(ctx) {
      return { id: ctx.params.tenant === 'acme' ? 1 : 2, name: 'Tenant', slug: ctx.params.tenant }
    },
    scope(query, tenant, options) {
      query.where(options.ownership, tenant.id)
    },
    fill(data: Record<string, unknown>) {
      return data
    },
    async listForUser() {
      return [
        { id: 1, name: 'Acme', slug: 'acme' },
        { id: 2, name: 'Globex', slug: 'globex' },
      ]
    },
  }
  const panel = definePanel('admin')
    .path('/admin')
    .middleware([testSessionAuthentication])
    .tenancy({ mode: 'url', adapter })
    .resources({ posts, categories: fixtureCategoryResource })
  const other = definePanel('other')
    .path('/other')
    .middleware([testSessionAuthentication])
    .resources({ posts })
  const fixture = await createTestApp({
    panels: { admin: async () => ({ default: panel }), other: async () => ({ default: other }) },
  })
  await fixture.database.connection().schema.dropTableIfExists('pupitre_table_views')
  await fixture.database.connection().schema.createTable('pupitre_table_views', (builder) => {
    builder.uuid('id').primary()
    builder.string('user_id')
    builder.string('panel')
    builder.string('tenant_key').nullable()
    builder.string('table_key')
    builder.string('name')
    builder.json('query')
    builder.json('columns')
    builder.boolean('is_public')
    builder.boolean('is_default')
    builder.timestamp('created_at')
    builder.timestamp('updated_at')
  })
  const owner = await User.firstOrCreate({ email: 'views-admin@example.test' }, { name: 'Owner' })
  const visitor = await User.firstOrCreate(
    { email: 'views-other@example.test' },
    { name: 'Visitor' }
  )
  return { fixture, owner: await fixture.loginAs(owner), visitor: await fixture.loginAs(visitor) }
}
function request(
  fixture: TestApplication,
  cookie: string,
  path: string,
  method = 'GET',
  body?: unknown
) {
  return fetch(`${fixture.baseUrl}${path}`, {
    method,
    redirect: 'manual',
    headers: { 'Cookie': cookie, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}
async function requestStatus(...args: Parameters<typeof request>) {
  const response = await request(...args)
  return response.status
}
async function requestBody(...args: Parameters<typeof request>) {
  const response = await request(...args)
  return response.json() as Promise<{ isDefault: boolean }[]>
}
const input = {
  name: 'My drafts',
  query: { filters: { status: 'draft' }, sort: '-title' },
  columns: { status: false },
  isPublic: false,
  isDefault: false,
}

test.group('saved table views HTTP', () => {
  test('preset builders are immutable and do not retain mutable caller state', ({ assert }) => {
    const base = tableView('Drafts')
    const query = { filters: { status: 'draft' } }
    const preset = base.query(query).columns({ status: false }).icon('file').default()
    query.filters.status = 'published'
    assert.deepEqual(base.toDefinition(), { name: 'Drafts', query: {} })
    assert.deepEqual(preset.toDefinition(), {
      name: 'Drafts',
      query: { filters: { status: 'draft' } },
      columns: { status: false },
      icon: 'file',
      isDefault: true,
    })
    const definition = preset.toDefinition()
    definition.query.q = 'changed'
    assert.notProperty(preset.toDefinition().query, 'q')
  })
  test('CRUD is owner-scoped and public mutations require an explicit policy ability', async ({
    assert,
  }) => {
    const { fixture, owner, visitor } = await setup()
    try {
      const created = await request(fixture, owner, '/admin/acme/posts/views', 'POST', input)
      assert.equal(created.status, 200)
      const saved = (await created.json()) as { id: string }
      const path = `/admin/acme/posts/views/${saved.id}`
      assert.equal(await requestStatus(fixture, visitor, path, 'PUT', input), 404)
      assert.equal(await requestStatus(fixture, visitor, path, 'DELETE'), 404)
      assert.equal(
        await requestStatus(fixture, owner, '/admin/acme/posts/views/not-a-uuid', 'DELETE'),
        404
      )
      assert.deepEqual(await requestBody(fixture, visitor, '/admin/acme/posts/views'), [])
      assert.equal(
        await requestStatus(fixture, owner, `/admin/globex/posts/views/${saved.id}`, 'PUT', input),
        404
      )
      assert.equal(
        await requestStatus(fixture, owner, `/other/posts/views/${saved.id}`, 'DELETE'),
        404
      )
      assert.equal(
        await requestStatus(fixture, visitor, '/admin/acme/posts/views', 'POST', {
          ...input,
          isPublic: true,
        }),
        403
      )
      assert.equal(
        await requestStatus(fixture, owner, path, 'PUT', {
          ...input,
          name: 'Shared drafts',
          isPublic: true,
        }),
        200
      )
      assert.lengthOf(await requestBody(fixture, visitor, '/admin/acme/posts/views'), 1)
      denyPolicyAbility('viewAny')
      assert.equal(await requestStatus(fixture, owner, '/admin/acme/posts/views'), 403)
      allowPolicyAbilities()
      assert.equal(await requestStatus(fixture, owner, path, 'DELETE'), 204)
      assert.lengthOf(await requestBody(fixture, owner, '/admin/acme/posts/views'), 0)
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })
  test('rejects invalid state and applies owner defaults before presets without overriding explicit URL state', async ({
    assert,
  }) => {
    const { fixture, owner } = await setup()
    try {
      for (const query of [
        { sort: 'missing' },
        { filters: { status: 'invalid' } },
        { filters: { unknown: 'draft' } },
        { perPage: 999 },
        { groupBy: 'unknown' },
        { tab: 'unknown' },
        { redirect: '//evil.test' },
        { columns: { title: { search: 123 } } },
      ]) {
        assert.equal(
          await requestStatus(fixture, owner, '/admin/acme/posts/views', 'POST', {
            ...input,
            query,
          }),
          422
        )
      }
      assert.equal(
        await requestStatus(fixture, owner, '/admin/acme/posts/views', 'POST', {
          ...input,
          columns: { title: false },
        }),
        422
      )
      const preset = await request(fixture, owner, '/admin/acme/posts')
      assert.equal(preset.status, 302)
      assert.include(preset.headers.get('location')!, 'preset%3A0')
      const created = await request(fixture, owner, '/admin/acme/posts/views', 'POST', {
        ...input,
        isDefault: true,
      })
      const saved = (await created.json()) as { id: string }
      const defaults = await request(fixture, owner, '/admin/acme/posts')
      assert.include(defaults.headers.get('location')!, saved.id)
      assert.equal(await requestStatus(fixture, owner, '/admin/acme/posts?q=explicit'), 200)
      const second = await request(fixture, owner, '/admin/acme/posts/views', 'POST', {
        ...input,
        name: 'Second',
        isDefault: true,
      })
      assert.equal(second.status, 200)
      const list = (await requestBody(fixture, owner, '/admin/acme/posts/views')) as {
        isDefault: boolean
      }[]
      assert.lengthOf(
        list.filter((view) => view.isDefault),
        1
      )
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('missing managePublicViews never falls back to permissive resource access', async ({
    assert,
  }) => {
    const { fixture, owner } = await setup(false)
    try {
      assert.equal(
        await requestStatus(fixture, owner, '/admin/acme/posts/views', 'POST', {
          ...input,
          isPublic: true,
        }),
        403
      )
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('relation views scope to the parent and preserve the relation query prefix', async ({
    assert,
  }) => {
    const { fixture, owner } = await setup()
    try {
      for (const malformed of ['abc', 'not-a-uuid']) {
        const path = `/admin/acme/posts/${malformed}/relations/category/views`
        for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
          assert.equal(
            await requestStatus(
              fixture,
              owner,
              method === 'PUT' || method === 'DELETE'
                ? `${path}/00000000-0000-4000-8000-000000000000`
                : path,
              method,
              method === 'POST' || method === 'PUT' ? input : undefined
            ),
            404
          )
        }
      }
      const category = await Category.create({ name: 'Category' })
      const post = await Post.create({
        title: 'Post',
        slug: 'post',
        status: 'draft',
        tenantId: 1,
        categoryId: category.id,
      })
      const base = `/admin/acme/posts/${post.id}/relations/category/views`
      const created = await request(fixture, owner, base, 'POST', {
        ...input,
        query: { q: 'Category', sort: 'name' },
        columns: {},
        isDefault: true,
      })
      assert.equal(created.status, 200)
      const saved = (await created.json()) as { id: string }
      const defaultPage = await request(
        fixture,
        owner,
        `/admin/acme/posts/${post.id}/edit?relation=category&q=outer`
      )
      assert.equal(defaultPage.status, 302)
      assert.include(defaultPage.headers.get('location')!, 'relation=category')
      assert.include(defaultPage.headers.get('location')!, 'q=outer')
      assert.include(defaultPage.headers.get('location')!, 'category%5Bq%5D=Category')
      assert.include(defaultPage.headers.get('location')!, saved.id)
      const explicit = await request(
        fixture,
        owner,
        `/admin/acme/posts/${post.id}/edit?relation=category&category[q]=explicit`
      )
      assert.equal(explicit.status, 200)
      const foreign = await Post.create({
        title: 'Other',
        slug: 'other-parent',
        status: 'draft',
        tenantId: 2,
      })
      assert.equal(
        await requestStatus(
          fixture,
          owner,
          `/admin/acme/posts/${foreign.id}/relations/category/views`
        ),
        404
      )
      assert.equal(
        await requestStatus(fixture, owner, `/admin/acme/posts/views/${saved.id}`, 'DELETE'),
        404
      )
      assert.equal(await requestStatus(fixture, owner, `${base}/${saved.id}`, 'DELETE'), 204)
      denyPolicyAbility('view')
      assert.equal(await requestStatus(fixture, owner, base), 403)
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })
  test('malformed nested saved-view parent identifiers return 404', async ({ assert }) => {
    const parent = fixtureCategoryResource
    const child = fixturePostResource.parent(parent, 'category').table(viewsTable)
    const fixture = await createTestApp({
      panels: {
        admin: async () => ({
          default: definePanel('admin')
            .middleware([testSessionAuthentication])
            .resources([parent.nested([child])]),
        }),
      },
    })
    try {
      const user = await User.create({ name: 'Nested owner', email: 'nested-views@example.test' })
      const cookie = await fixture.loginAs(user)
      assert.equal(await requestStatus(fixture, cookie, '/admin/categories/abc/posts/views'), 404)
    } finally {
      await closeTestApp(fixture)
    }
  })
})
