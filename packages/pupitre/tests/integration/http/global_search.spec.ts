import { test } from '@japa/runner'
import type { TenancyAdapter } from '../../../src/definition/tenancy.js'
import { definePanel } from '../../../index.js'
import { globalSearchResponse } from '../../../catalog/wire.js'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  fixtureCategoryResource,
  fixturePostResource,
  Post,
} from '../../helpers/app.js'
import type { TestApplication } from '../../helpers/app.js'
import { seed, teardown } from '../../helpers/db.js'
class SearchCapPolicy {
  viewAny() {
    return true
  }

  view(_user: unknown, record: Post) {
    return record.title.includes('Authorized')
  }
  update() {
    return false
  }
}

const searchablePostResource = fixturePostResource
  .globallySearchable(['title', 'slug', 'author.name'])
  .globalSearchDetails((record) => [record.status])
const searchableCategoryResource = fixtureCategoryResource
  .recordTitle('name')
  .globallySearchable(['name'])
const searchPanel = definePanel('admin')
  .path('/admin')
  .resources({ posts: searchablePostResource, categories: searchableCategoryResource })
const disabledSearchPanel = definePanel('admin')
  .path('/admin')
  .resources({ posts: searchablePostResource })
  .globalSearch(false)

let fixture: TestApplication

test.group('Pupitre global search', (group) => {
  group.setup(async () => {
    fixture = await createTestApp({ panels: { admin: async () => ({ default: searchPanel }) } })
  })
  group.teardown(async () => {
    allowPolicyAbilities()
    await closeTestApp(fixture)
    await teardown()
  })

  test('returns at most five scoped results per resource and matches relation columns', async ({
    assert,
  }) => {
    const { users } = await seed({
      users: [{ name: 'Ada', fullName: 'Ada Lovelace', email: 'ada@example.test' }],
      categories: [{ name: 'Ada' }],
    })
    await Post.createMany(
      Array.from({ length: 7 }, (_, index) => ({
        title: `Searchable entry ${index}`,
        slug: `searchable-entry-${index}`,
        status: 'draft',
        authorId: users[0].id,
        tenantId: 1,
      }))
    )
    await Post.create({
      title: 'Outside resource scope',
      slug: 'outside-scope',
      status: 'draft',
      authorId: users[0].id,
      tenantId: 2,
    })

    const response = await fetch(`${fixture.baseUrl}/admin/_pupitre/search?q=ADA`, {
      headers: { Accept: 'application/json', Connection: 'close' },
    })
    const result = globalSearchResponse.parse(await response.json())
    assert.equal(response.status, 200)
    assert.lengthOf(result.groups, 2)
    assert.deepEqual(result.groups.map((resultGroup) => resultGroup.resource).sort(), [
      'categories',
      'posts',
    ])
    assert.lengthOf(result.groups[0].results, 5)
    assert.isTrue(result.groups[0].results.every((item) => item.url.startsWith('/admin/posts/')))
    assert.isTrue(result.groups[0].results.every((item) => item.details?.[0] === 'draft'))
    assert.isTrue(result.groups[0].results.some((item) => item.title === 'Searchable entry 0'))
    assert.isTrue(result.groups[0].results.every((item) => !item.url.endsWith('/edit')))
    const scopedOutResponse = await fetch(`${fixture.baseUrl}/admin/_pupitre/search?q=Outside`, {
      headers: { Accept: 'application/json', Connection: 'close' },
    })
    const scopedOut = globalSearchResponse.parse(await scopedOutResponse.json())
    assert.lengthOf(scopedOut.groups, 0)
  })

  test('filters groups and record URLs using policies', async ({ assert }) => {
    const post = await Post.create({
      title: 'Policy search target',
      slug: 'policy-search-target',
      status: 'draft',
      tenantId: 1,
    })
    try {
      denyPolicyAbility('view')
      let response = await fetch(`${fixture.baseUrl}/admin/_pupitre/search?q=Policy`, {
        headers: { Accept: 'application/json', Connection: 'close' },
      })
      let result = globalSearchResponse.parse(await response.json())
      assert.equal(result.groups[0].results[0].url, `/admin/posts/${post.id}/edit`)

      denyPolicyAbility('update')
      response = await fetch(`${fixture.baseUrl}/admin/_pupitre/search?q=Policy`, {
        headers: { Accept: 'application/json', Connection: 'close' },
      })
      result = globalSearchResponse.parse(await response.json())
      assert.lengthOf(result.groups, 0)

      allowPolicyAbilities()
      denyPolicyAbility('viewAny')
      response = await fetch(`${fixture.baseUrl}/admin/_pupitre/search?q=Policy`, {
        headers: { Accept: 'application/json', Connection: 'close' },
      })
      result = globalSearchResponse.parse(await response.json())
      assert.lengthOf(result.groups, 0)
    } finally {
      allowPolicyAbilities()
    }
  })
  test('fills the five-result cap with records authorized after denied matches', async ({
    assert,
  }) => {
    const resource = fixturePostResource.policy(SearchCapPolicy).globallySearchable(['title'])
    const panel = definePanel('admin').path('/cap-search').resources({ posts: resource })
    const capFixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
    })
    try {
      await Post.createMany(
        Array.from({ length: 30 }, (_, index) => ({
          title: `Target blocked ${index}`,
          slug: `target-blocked-${index}`,
          status: 'draft',
          tenantId: 1,
        }))
      )
      await Post.createMany(
        Array.from({ length: 7 }, (_, index) => ({
          title: `Target Authorized ${index}`,
          slug: `target-authorized-${index}`,
          status: 'draft',
          tenantId: 1,
        }))
      )
      const response = await fetch(`${capFixture.baseUrl}/cap-search/_pupitre/search?q=Target`, {
        headers: { Accept: 'application/json', Connection: 'close' },
      })
      assert.equal(response.status, 200, await response.clone().text())
      const result = globalSearchResponse.parse(await response.json())
      assert.equal(response.status, 200)
      assert.lengthOf(result.groups[0]?.results ?? [], 5)
      assert.deepEqual(
        result.groups[0]!.results.map((item) => item.title),
        Array.from({ length: 5 }, (_, index) => `Target Authorized ${index}`)
      )
      assert.equal(new Set(result.groups[0]!.results.map((item) => item.title)).size, 5)
    } finally {
      await closeTestApp(capFixture)
    }
  })
  test('scopes global search and result URLs through panel URL tenancy', async ({ assert }) => {
    const adapter: TenancyAdapter = {
      async resolve(ctx) {
        const slug = String(ctx.params.tenant ?? '')
        if (slug !== 'acme' && slug !== 'globex') return null
        return { id: slug === 'acme' ? 1 : 2, name: slug, slug }
      },
      scope(query, tenant, options) {
        query.where(options.ownership, tenant.id)
      },
      fill(data, tenant) {
        return { ...data, tenantId: tenant.id }
      },
      async listForUser() {
        return []
      },
    }
    const panel = definePanel('admin')
      .path('/admin')
      .tenancy({ mode: 'url', adapter })
      .resources({ posts: searchablePostResource.scope(() => {}) })
    const tenantFixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
    })
    try {
      await Post.create({
        title: 'Tenant-scoped search target',
        slug: 'tenant-scoped-search-target',
        status: 'draft',
        tenantId: 1,
      })
      await Post.create({
        title: 'Tenant-scoped search target outside',
        slug: 'tenant-scoped-search-target-outside',
        status: 'draft',
        tenantId: 2,
      })
      const response = await fetch(
        `${tenantFixture.baseUrl}/admin/acme/_pupitre/search?q=Tenant-scoped`,
        { headers: { Accept: 'application/json', Connection: 'close' } }
      )
      const result = globalSearchResponse.parse(await response.json())
      assert.equal(response.status, 200)
      assert.lengthOf(result.groups[0]?.results ?? [], 1)
      assert.isTrue(result.groups[0]?.results[0]?.url.startsWith('/admin/acme/posts/'))
      assert.equal(result.groups[0]?.results[0]?.title, 'Tenant-scoped search target')
    } finally {
      await closeTestApp(tenantFixture)
    }
  })

  test('returns empty groups for short queries', async ({ assert }) => {
    const response = await fetch(`${fixture.baseUrl}/admin/_pupitre/search?q=%20`, {
      headers: { Accept: 'application/json', Connection: 'close' },
    })
    assert.deepEqual(await response.json(), { groups: [] })
  })
  test('shares search URL and configured shortcut when a resource is searchable', async ({
    assert,
  }) => {
    const response = await fetch(`${fixture.baseUrl}/admin/posts`, {
      headers: {
        'Accept': 'text/html',
        'X-Inertia': 'true',
        'X-Inertia-Version': '1',
        'X-Requested-With': 'XMLHttpRequest',
        'Connection': 'close',
      },
    })
    assert.equal(response.status, 200)
    const page = (await response.json()) as {
      props?: { pupitre?: { panel?: { search?: { url: string; keyBinding: string } } } }
    }
    assert.deepEqual(page.props?.pupitre?.panel?.search, {
      url: '/admin/_pupitre/search',
      keyBinding: 'mod+k',
    })
  })
})

let disabledFixture: TestApplication

test.group('Pupitre disabled global search', (group) => {
  group.setup(async () => {
    disabledFixture = await createTestApp({
      panels: { admin: async () => ({ default: disabledSearchPanel }) },
    })
  })
  group.teardown(async () => {
    await closeTestApp(disabledFixture)
    await teardown()
  })

  test('hides shared search props and returns 404 from the endpoint', async ({ assert }) => {
    const response = await fetch(`${disabledFixture.baseUrl}/admin/_pupitre/search?q=entry`, {
      headers: { Accept: 'application/json', Connection: 'close' },
    })
    assert.equal(response.status, 404)

    const pageResponse = await fetch(`${disabledFixture.baseUrl}/admin/posts`, {
      headers: {
        'Accept': 'text/html',
        'X-Inertia': 'true',
        'X-Inertia-Version': '1',
        'X-Requested-With': 'XMLHttpRequest',
        'Connection': 'close',
      },
    })
    assert.equal(pageResponse.status, 200)
    const page = (await pageResponse.json()) as { props?: { pupitre?: { panel?: unknown } } }
    assert.notProperty((page.props?.pupitre?.panel ?? {}) as object, 'search')
  })
})
