import { test } from '@japa/runner'
import type { ApplicationService } from '@adonisjs/core/types'
import { defineCluster, definePanel, definePage } from '../../../index.js'
import PupitreManager, { bindPanel } from '../../../src/manager.js'
import {
  closeTestApp,
  createTestApp,
  fixturePostResource,
  fixtureCategoryResource,
  Post,
  Category,
  User,
} from '../../helpers/app.js'

class ClusterPolicy {
  viewAny(user: User) {
    return user.name === 'Allowed'
  }
  view(user: User) {
    return user.name === 'Allowed'
  }
  update(user: User) {
    return user.name === 'Allowed'
  }
}

class PartialPostPolicy extends ClusterPolicy {
  viewAny(user: User) {
    return user.name === 'Partial' || super.viewAny(user)
  }
}

const cluster = defineCluster('catalog').label('Catalog').icon('tag').sort(2)

test('clusters reject collisions and conflicting definitions at boot', async ({ assert }) => {
  for (const resources of [
    [fixturePostResource.cluster(defineCluster('categories')), fixtureCategoryResource],
    [fixturePostResource.cluster(cluster), fixtureCategoryResource.cluster(cluster.label('Other'))],
  ]) {
    const manager = new PupitreManager({} as ApplicationService)
    await assert.rejects(
      () => manager.boot([definePanel('admin').resources(resources)]),
      /cluster/i
    )
  }
  assert.equal(cluster.toDefinition().label, 'Catalog')
  assert.equal(cluster.label('Changed').toDefinition().label, 'Changed')
})

test('clusters filter navigation, siblings, breadcrumbs and search with tenant-prefixed URLs', async ({
  assert,
}) => {
  const panel = definePanel('admin')
    .path('/admin')
    .guard('web')
    .globalSearch()
    .resources([
      fixturePostResource.cluster(cluster).policy(PartialPostPolicy).globallySearchable(['title']),
      fixtureCategoryResource.cluster(cluster).policy(ClusterPolicy),
    ])
    .pages([
      definePage('preferences')
        .cluster(cluster)
        .canAccess((ctx) => ctx.pupitre.user?.name === 'Allowed'),
    ])
  const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
  try {
    const allowed = await User.create({ name: 'Allowed', email: 'clusters-allowed@example.test' })
    const denied = await User.create({ name: 'Denied', email: 'clusters-denied@example.test' })
    const cookie = await fixture.loginAs(allowed)
    const deniedCookie = await fixture.loginAs(denied)
    const partial = await User.create({ name: 'Partial', email: 'clusters-partial@example.test' })
    const partialCookie = await fixture.loginAs(partial)
    const record = await Post.create({
      title: 'Cluster searchable',
      slug: 'cluster-searchable',
      status: 'draft',
      tenantId: 1,
    })
    const headers = {
      'Accept': 'text/html',
      'X-Inertia': 'true',
      'X-Inertia-Version': '1',
      'Cookie': cookie,
    }
    const response = await fetch(`${fixture.baseUrl}/admin/catalog/posts`, { headers })
    assert.equal(response.status, 200)
    const body = (await response.json()) as {
      props: {
        pupitre: { nav: { items: { label: string; url: string }[] }[] }
        page: {
          clusterNavigation: { key: string; url: string }[]
          breadcrumbs: { label: string }[]
        }
      }
    }
    assert.deepEqual(
      body.props.pupitre.nav.flatMap((group) => group.items.map((item) => item.label)),
      ['Catalog']
    )
    assert.sameMembers(
      body.props.page.clusterNavigation.map((item) => item.key),
      ['posts', 'categories', 'preferences']
    )
    assert.include(
      body.props.page.breadcrumbs.map((item) => item.label),
      'Catalog'
    )
    const partialResponse = await fetch(`${fixture.baseUrl}/admin/catalog/posts`, {
      headers: { ...headers, Cookie: partialCookie },
    })
    assert.equal(partialResponse.status, 200)
    const partialBody = (await partialResponse.json()) as typeof body
    assert.deepEqual(
      partialBody.props.pupitre.nav.flatMap((entry) => entry.items.map((item) => item.label)),
      ['Catalog']
    )
    assert.deepEqual(
      partialBody.props.page.clusterNavigation.map((item) => item.key),
      ['posts']
    )
    const deniedList = await fetch(`${fixture.baseUrl}/admin/catalog/posts`, {
      headers: { Accept: 'application/json', Cookie: deniedCookie },
    })
    assert.equal(deniedList.status, 403)
    const dashboard = await fetch(`${fixture.baseUrl}/admin`, {
      headers: { ...headers, Cookie: deniedCookie },
      redirect: 'manual',
    })
    assert.equal(dashboard.status, 404)
    const deniedPage = await fetch(`${fixture.baseUrl}/admin/catalog/preferences`, {
      headers: { Accept: 'application/json', Cookie: deniedCookie },
    })
    assert.equal(deniedPage.status, 403)
    const search = await fetch(`${fixture.baseUrl}/admin/_pupitre/search?q=Cluster`, {
      headers: { Cookie: cookie, Accept: 'application/json' },
    })
    const searchBody = (await search.json()) as { groups: { results: { url: string }[] }[] }
    assert.include(
      searchBody.groups.flatMap((group) => group.results.map((item) => item.url)),
      `/admin/catalog/posts/${record.id}`
    )
    const manager = (await fixture.app.container.make('pupitre.manager')) as PupitreManager
    const bound = bindPanel(manager.panels[0]!, '/admin/acme')
    assert.equal(
      bound.resources.find((resource) => resource.slug === 'posts')!.urls.list,
      '/admin/acme/catalog/posts'
    )
    assert.equal(bound.pages[0]!.url, '/admin/acme/catalog/preferences')
    const router = await fixture.app.container.make('router')
    assert.include(
      Object.values(router.toJSON())
        .flat()
        .map((route) => route.pattern),
      '/admin/catalog/posts'
    )
  } finally {
    await closeTestApp(fixture)
  }
})

test('cluster routes preserve URL tenancy and reject foreign records and tenants', async ({
  assert,
}) => {
  const tenant = { id: 1, name: 'Acme', slug: 'acme' }
  const panel = definePanel('admin')
    .path('/admin')
    .tenancy({
      mode: 'url',
      adapter: {
        async resolve(ctx) {
          return ctx.params.tenant === 'acme' ? tenant : null
        },
        async listForUser() {
          return [tenant]
        },
        scope(query, current, options) {
          query.where(options.ownership, current.id)
        },
        fill(data, current) {
          return { ...data, tenantId: current.id }
        },
      },
    })
    .resources([fixturePostResource.cluster(cluster).scope(() => {})])
  const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
  try {
    const foreign = await Post.create({
      title: 'Foreign cluster record',
      slug: 'foreign-cluster',
      status: 'draft',
      tenantId: 2,
    })
    const headers = { 'Accept': 'text/html', 'X-Inertia': 'true', 'X-Inertia-Version': '1' }
    const list = await fetch(`${fixture.baseUrl}/admin/acme/catalog/posts`, { headers })
    assert.equal(list.status, 200)
    const foreignPage = await fetch(
      `${fixture.baseUrl}/admin/acme/catalog/posts/${foreign.id}/edit`,
      { headers }
    )
    assert.equal(foreignPage.status, 404)
    const nonMember = await fetch(`${fixture.baseUrl}/admin/globex/catalog/posts`, { headers })
    assert.equal(nonMember.status, 404)
    const body = (await list.json()) as {
      props: { page: { clusterNavigation: { url: string }[] } }
    }
    assert.equal(body.props.page.clusterNavigation[0]!.url, '/admin/acme/catalog/posts')
  } finally {
    await closeTestApp(fixture)
  }
})

test('nested resources inherit their cluster prefix and retain parent-scoped records', async ({
  assert,
}) => {
  const parent = fixtureCategoryResource.cluster(cluster)
  const child = fixturePostResource.parent(parent, 'category')
  const panel = definePanel('admin')
    .path('/admin')
    .resources([parent.nested([child])])
  const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
  try {
    const category = await Category.create({ name: 'Cluster parent' })
    const otherCategory = await Category.create({ name: 'Other parent' })
    const record = await Post.create({
      title: 'Nested clustered post',
      slug: 'nested-cluster',
      status: 'draft',
      categoryId: category.id,
      tenantId: 1,
    })
    const headers = { 'Accept': 'text/html', 'X-Inertia': 'true', 'X-Inertia-Version': '1' }
    const nested = await fetch(
      `${fixture.baseUrl}/admin/catalog/categories/${category.id}/posts/${record.id}/edit`,
      { headers }
    )
    assert.equal(nested.status, 200)
    const wrongParent = await fetch(
      `${fixture.baseUrl}/admin/catalog/categories/${otherCategory.id}/posts/${record.id}/edit`,
      { headers }
    )
    assert.equal(wrongParent.status, 404)
  } finally {
    await closeTestApp(fixture)
  }
})
