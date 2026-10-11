import { test } from '@japa/runner'
import type { TenancyAdapter } from '../../../src/definition/tenancy.js'
import { definePanel } from '../../../index.js'
import {
  closeTestApp,
  createTestApp,
  fixtureCategoryResource,
  fixturePostResource,
  Post,
  Category,
  User,
} from '../../helpers/app.js'

function tenantAdapter(
  memberships: { id: number; name: string; slug: string }[] = [
    { id: 1, name: 'Acme', slug: 'acme' },
    { id: 2, name: 'Globex', slug: 'globex' },
  ]
): TenancyAdapter {
  return {
    async resolve(ctx) {
      const slug = String(ctx.params.tenant ?? '')
      if (slug !== 'acme' && slug !== 'globex') return null
      const id = slug === 'acme' ? 1 : 2
      return { id, name: slug, slug }
    },
    scope(query, tenant, options) {
      query.where(options.ownership, tenant.id)
    },
    fill(data, tenant, options) {
      return {
        ...data,
        [options.ownership === 'tenant_id' ? 'tenantId' : options.ownership]: tenant.id,
      }
    },
    async listForUser() {
      return memberships
    },
  }
}

const tenancyPanel = definePanel('admin')
  .path('/admin')
  .tenancy({ mode: 'url', adapter: tenantAdapter() })
  .resources({
    posts: fixturePostResource.scope(() => {}).globallySearchable(['title']),
    categories: fixtureCategoryResource.scope(false),
  })

async function inertia(baseUrl: string, path: string, method = 'GET', body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Accept': 'text/html',
      'X-Inertia': 'true',
      'X-Inertia-Version': '1',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

test.group('Pupitre tenancy', () => {
  test('scopes records, fills create ownership after hooks, protects update, and supports global resources', async ({
    assert,
  }) => {
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: tenancyPanel }) },
    })
    try {
      await Post.create({ title: 'Acme record', slug: 'acme-record', status: 'draft', tenantId: 1 })
      const globex = await Post.create({
        title: 'Globex record',
        slug: 'globex-record',
        status: 'draft',
        tenantId: 2,
      })
      await Category.create({ name: 'Global category' })
      const dashboard = await fetch(`${fixture.baseUrl}/admin/acme`, { redirect: 'manual' })
      assert.equal(dashboard.status, 302)
      assert.equal(dashboard.headers.get('location'), '/admin/acme/posts')

      const foreign = await inertia(fixture.baseUrl, `/admin/acme/posts/${globex.id}/edit`)
      assert.equal(foreign.status, 404)
      const nonMember = await inertia(fixture.baseUrl, '/admin/not-a-member/posts')
      assert.equal(nonMember.status, 404)
      const foreignDelete = await fetch(`${fixture.baseUrl}/admin/acme/posts/${globex.id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      })
      assert.equal(foreignDelete.status, 404)
      const foreignAction = await fetch(
        `${fixture.baseUrl}/admin/acme/posts/${globex.id}/actions/publish`,
        {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'cross-tenant' }),
        }
      )
      assert.equal(foreignAction.status, 404)
      const upload = new FormData()
      upload.set('resource', 'posts')
      upload.set('field', 'cover')
      upload.set('record', String(globex.id))
      const foreignUpload = await fetch(`${fixture.baseUrl}/admin/acme/_pupitre/upload`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: upload,
      })
      assert.equal(foreignUpload.status, 404)
      const globalList = await inertia(fixture.baseUrl, '/admin/acme/categories')
      assert.equal(globalList.status, 200)
      assert.include(await globalList.text(), 'Global category')

      const createdSlug = `created-${Date.now()}`
      const createResponse = await inertia(fixture.baseUrl, '/admin/globex/posts', 'POST', {
        title: 'Created in Globex',
        slug: createdSlug,
        status: 'draft',
      })
      assert.isTrue([200, 302, 303].includes(createResponse.status))
      const created = await Post.findByOrFail('slug', createdSlug)
      assert.equal(created.tenantId, 2)

      const updateResponse = await inertia(
        fixture.baseUrl,
        `/admin/globex/posts/${globex.id}`,
        'PUT',
        {
          title: 'Stayed in Globex',
          slug: globex.slug,
          status: 'draft',
          tenantId: 1,
        }
      )
      assert.isTrue([200, 302, 303].includes(updateResponse.status))
      await globex.refresh()
      assert.equal(globex.tenantId, 2)
      assert.equal(globex.title, 'Stayed in Globex')

      const list = await inertia(fixture.baseUrl, '/admin/acme/posts?q=Acme%20record')
      assert.equal(list.status, 200)
      const props = (await list.json()) as { props: { page: { key: string }; data: unknown } }
      assert.include(props.props.page.key, ':1')
      assert.include(JSON.stringify(props.props.data), 'Acme record')
      assert.include(JSON.stringify(props.props), '/admin/acme/posts')
      assert.notInclude(JSON.stringify(props.props.data), 'Globex record')
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('binds profile shell URLs to the first tenant membership without tenant-prefixing auth routes', async ({
    assert,
  }) => {
    const memberships = [
      { id: 1, name: 'Acme', slug: 'acme' },
      { id: 2, name: 'Globex', slug: 'globex' },
    ]
    const panel = tenancyPanel
      .tenancy({ mode: 'url', adapter: tenantAdapter(memberships) })
      .guard('web')
      .login()
      .profile()
      .globalSearch()
      .notifications({ interval: 30_000 })
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: {
        auth: { model: async () => ({ default: User }) },
        notifications: async () => ({
          async toInbox() {},
          async inbox() {
            return {
              items: [],
              meta: { total: 0, perPage: 20, currentPage: 1, lastPage: 1 },
            }
          },
          async unreadCount() {
            return 0
          },
          async markRead() {},
        }),
      },
    })
    try {
      const user = await User.create({
        name: 'Tenant Profile',
        fullName: 'Tenant Profile',
        email: 'tenant-profile@example.test',
        password: 'tenant-password',
      })
      const cookie = await fixture.loginAs(user)
      const response = await fetch(`${fixture.baseUrl}/admin/profile`, {
        headers: {
          'Cookie': cookie,
          'Accept': 'text/html',
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
        },
      })
      assert.equal(response.status, 200)
      const payload = (await response.json()) as {
        props: {
          pupitre: {
            panel: {
              path: string
              logoutUrl?: string
              profileUrl?: string
              search?: { url: string }
            }
            nav: unknown
            notifications?: { url: string; readUrl: string }
          }
        }
      }
      const { panel: shell } = payload.props.pupitre
      assert.equal(shell.path, '/admin/acme')
      assert.equal(shell.logoutUrl, '/admin/logout')
      assert.equal(shell.profileUrl, '/admin/profile')
      assert.equal(shell.search?.url, '/admin/acme/_pupitre/search')
      assert.equal(payload.props.pupitre.notifications?.url, '/admin/acme/_pupitre/notifications')
      assert.equal(
        payload.props.pupitre.notifications?.readUrl,
        '/admin/acme/_pupitre/notifications/read'
      )
      assert.include(JSON.stringify(payload.props.pupitre.nav), '/admin/acme/posts')
      const tenantDashboard = await fetch(`${fixture.baseUrl}/admin/acme`, {
        headers: { Cookie: cookie, Accept: 'text/html' },
        redirect: 'manual',
      })
      assert.equal(tenantDashboard.status, 302)
      assert.equal(tenantDashboard.headers.get('location'), '/admin/acme/posts')
      const otherDashboard = await fetch(`${fixture.baseUrl}/admin/globex`, {
        headers: { Cookie: cookie, Accept: 'text/html' },
        redirect: 'manual',
      })
      assert.equal(otherDashboard.status, 302)
      assert.equal(otherDashboard.headers.get('location'), '/admin/globex/posts')
      const globexPosts = await fetch(`${fixture.baseUrl}/admin/globex/posts`, {
        headers: {
          'Cookie': cookie,
          'Accept': 'text/html',
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
        },
      })
      assert.equal(globexPosts.status, 200)
      const globexPayload = (await globexPosts.json()) as typeof payload
      assert.equal(globexPayload.props.pupitre.panel.path, '/admin/globex')
      assert.equal(globexPayload.props.pupitre.panel.search?.url, '/admin/globex/_pupitre/search')
      assert.equal(
        globexPayload.props.pupitre.notifications?.url,
        '/admin/globex/_pupitre/notifications'
      )
      assert.include(JSON.stringify(globexPayload.props.pupitre.nav), '/admin/globex/posts')
      assert.notInclude(JSON.stringify(globexPayload.props), '/admin/acme/')
      memberships.length = 0
      const noMembership = await fetch(`${fixture.baseUrl}/admin/profile`, {
        headers: {
          'Cookie': cookie,
          'Accept': 'text/html',
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
        },
      })
      assert.equal(noMembership.status, 200)
      const noMembershipPayload = (await noMembership.json()) as typeof payload
      assert.equal(noMembershipPayload.props.pupitre.panel.path, '/admin')
      assert.deepEqual(noMembershipPayload.props.pupitre.nav, [])
      assert.isUndefined(noMembershipPayload.props.pupitre.panel.search)
      assert.isUndefined(noMembershipPayload.props.pupitre.notifications)
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('selects the first implicit membership, switches only for members, and fails closed without tenants', async ({
    assert,
  }) => {
    const memberships = [
      { id: 1, name: 'Acme', slug: 'acme' },
      { id: 2, name: 'Globex', slug: 'globex' },
    ]
    let selected: number | null = null
    const adapter: TenancyAdapter = {
      async resolve() {
        return memberships.find((tenant) => tenant.id === selected) ?? null
      },
      scope(query, tenant, options) {
        query.where(options.ownership, tenant.id)
      },
      fill(data, tenant) {
        return { ...data, tenantId: tenant.id }
      },
      async listForUser() {
        return memberships
      },
      async switch(_ctx, tenantId) {
        const member = memberships.find((tenant) => String(tenant.id) === String(tenantId))
        if (!member) return false
        selected = member.id
        return true
      },
    }
    const panel = definePanel('admin')
      .path('/admin')
      .tenancy({ mode: 'implicit', adapter })
      .resources({ posts: fixturePostResource.scope(() => {}) })
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      await Post.create({
        title: 'Acme implicit',
        slug: 'implicit-acme',
        status: 'draft',
        tenantId: 1,
      })
      await Post.create({
        title: 'Globex implicit',
        slug: 'implicit-globex',
        status: 'draft',
        tenantId: 2,
      })
      const first = await inertia(fixture.baseUrl, '/admin/posts')
      assert.equal(first.status, 200)
      assert.equal(selected, 1)
      const firstBody = (await first.json()) as { props: { pupitre: { tenant: { id: number } } } }
      assert.equal(firstBody.props.pupitre.tenant.id, 1)

      const deniedSwitch = await fetch(`${fixture.baseUrl}/admin/_pupitre/tenant`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: 3 }),
      })
      assert.equal(deniedSwitch.status, 403)
      const switched = await inertia(fixture.baseUrl, '/admin/_pupitre/tenant', 'POST', {
        tenant: 2,
      })
      assert.isTrue([200, 302, 303].includes(switched.status))
      const second = await inertia(fixture.baseUrl, '/admin/posts')
      assert.equal(second.status, 200)
      const secondBody = (await second.json()) as { props: { pupitre: { tenant: { id: number } } } }
      assert.equal(secondBody.props.pupitre.tenant.id, 2)

      memberships.length = 0
      const none = await fetch(`${fixture.baseUrl}/admin/posts`, {
        headers: { Accept: 'application/json' },
      })
      assert.equal(none.status, 403)
      const noTenantLoop = await fetch(`${fixture.baseUrl}/admin/posts`, {
        headers: { Accept: 'text/html', Referer: `${fixture.baseUrl}/admin/login` },
        redirect: 'manual',
      })
      assert.equal(noTenantLoop.status, 403)
      assert.isNull(noTenantLoop.headers.get('location'))
    } finally {
      await closeTestApp(fixture)
    }
  })
})
