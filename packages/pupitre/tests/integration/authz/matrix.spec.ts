import { test } from '@japa/runner'
import {
  allowPolicyAbilities,
  Category,
  closeTestApp,
  createTestApp,
  denyCategoryPolicyAbility,
  denyPolicyAbility,
  Post,
} from '../../helpers/app.js'

type RouteInfo = { methods: string[]; pattern: string; name?: string }
type RouteClass = { kind: string; ability?: string; expected: string }

function classifyPanelRoute(name: string): RouteClass | undefined {
  if (name === 'admin.dashboard')
    return { kind: 'dashboard', ability: 'viewAny', expected: '404 when denied' }
  if (name === 'admin.widgets.data')
    return {
      kind: 'widget data',
      expected: 'widget visibility and contextual resource authorization',
    }
  if (name === 'admin.upload.store')
    return { kind: 'upload', ability: 'create/update', expected: '403 when denied' }
  if (name === 'admin.upload.destroy')
    return { kind: 'upload ownership', expected: '403 unless session-owned' }
  if (name === 'admin.search')
    return { kind: 'search', ability: 'viewAny', expected: 'only authorized resources returned' }
  if (name === 'admin.options')
    return {
      kind: 'related-model options search',
      ability: 'viewAny',
      expected: '403 when related model denied',
    }
  if (name === 'admin.options.store')
    return {
      kind: 'related-model option creation',
      ability: 'create',
      expected: '403 when related model denied',
    }
  if (name === 'admin.notifications' || name === 'admin.notifications.read')
    return { kind: 'notifications', expected: 'authenticated feature endpoint' }
  if (name.startsWith('admin.auth.')) return { kind: 'guest auth', expected: 'no resource policy' }
  if (name === 'admin.profile' || name.startsWith('admin.profile.'))
    return { kind: 'profile', expected: 'authenticated user endpoint' }
  if (name === 'admin.tenant.home' || name === 'admin.tenant.switch')
    return { kind: 'tenant membership', expected: 'membership-scoped' }
  if (name === 'admin.exports.progress' || name === 'admin.exports.download')
    return { kind: 'export file', expected: 'owner and tenant scoped' }
  if (name.includes('.relations.'))
    return {
      kind: 'relation manager',
      ability: 'viewAny related model',
      expected: 'related-model policy',
    }
  if (name === 'admin.settings' || name.startsWith('admin.pages.'))
    return { kind: 'custom page', expected: 'page access gate' }
  if (/^admin\.[a-z][a-z0-9-]*$/.test(name))
    return { kind: 'custom page', expected: 'page access gate' }
  const resourceRoute =
    /^admin\.(posts|categories)\.(list|create|store|edit|update|view|destroy|export|import\.preview|import\.store|column\.update|reorder|actions|actions\.store|record\.actions|record\.actions\.store)$/.exec(
      name
    )
  if (!resourceRoute) return undefined
  const [, resourceSlug, page] = resourceRoute
  if (page === 'list') return { kind: `${resourceSlug}.list`, ability: 'viewAny', expected: '403' }
  if (page === 'create' || page === 'store')
    return { kind: `${resourceSlug}.create`, ability: 'create', expected: '403' }
  if (page === 'column.update')
    return { kind: `${resourceSlug}.column`, ability: 'update', expected: '403' }
  if (page === 'import.preview' || page === 'import.store')
    return { kind: `${resourceSlug}.import`, expected: '404 when no import action is configured' }
  if (page === 'export')
    return { kind: `${resourceSlug}.export`, expected: '404 when no export action is configured' }
  if (page === 'reorder')
    return { kind: `${resourceSlug}.reorder`, expected: 'reorder or update ability' }
  if (page === 'edit' || page === 'update')
    return { kind: `${resourceSlug}.edit`, ability: 'update', expected: '403' }
  if (page === 'view') return { kind: `${resourceSlug}.view`, ability: 'view', expected: '403' }
  if (page === 'destroy')
    return { kind: `${resourceSlug}.destroy`, ability: 'delete', expected: '403' }
  return {
    kind: `${resourceSlug}.${page}`,
    ability: 'action ability',
    expected: '403 or 404 if no action is defined',
  }
}

function deniedAbilitiesForRoute(route: RouteInfo, ability: string, method: string) {
  if (route.name === 'admin.upload.store') return ['create', 'update']
  if (route.name?.endsWith('.actions') || route.name?.endsWith('.actions.store')) {
    return route.name.includes('.record.') ? ['publish'] : [method === 'POST' ? 'delete' : 'create']
  }
  return [ability]
}

test.group('Pupitre panel authorization route matrix', () => {
  test('classifies every registered panel route and denies mapped resource abilities', async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      const post = await Post.create({
        title: 'Authz route matrix post',
        slug: `authz-route-matrix-${Date.now()}`,
        status: 'draft',
        tenantId: 1,
      })
      const category = await Category.create({ name: `Authz route matrix ${Date.now()}` })
      const router = await fixture.app.container.make('router')
      const routes = Object.values(router.toJSON()).flat() as RouteInfo[]
      const panelRoutes = routes.filter((route) => route.name?.startsWith('admin.'))
      assert.isNotEmpty(panelRoutes, 'Expected routes registered for the admin panel')
      const resourceRoutes: RouteInfo[] = []
      for (const route of panelRoutes) {
        assert.isString(route.name, `Panel route has no name: ${route.pattern}`)
        const classification = classifyPanelRoute(route.name!)
        assert.isDefined(
          classification,
          `Unclassified panel route ${route.methods.join('|')} ${route.pattern} (${route.name}); add a mapping in matrix.spec.ts`
        )
        if (route.name!.startsWith('admin.posts.') || route.name!.startsWith('admin.categories.')) {
          resourceRoutes.push(route)
        }
      }

      for (const route of resourceRoutes) {
        const name = route.name!
        const categoryResource = name.startsWith('admin.categories.')
        const recordId = categoryResource ? category.id : post.id
        for (const method of route.methods) {
          const classification = classifyPanelRoute(name)!
          if (!classification.ability) continue
          const abilities = deniedAbilitiesForRoute(route, classification.ability, method)
          for (const ability of abilities) {
            if (categoryResource) denyCategoryPolicyAbility(ability)
            else denyPolicyAbility(ability)
            const actionRoute = name.endsWith('.actions') || name.endsWith('.actions.store')
            const actionName = categoryResource
              ? 'missing-action'
              : name.includes('.record.')
                ? 'publish'
                : method === 'POST'
                  ? 'delete'
                  : 'create'
            const path = route.pattern
              .replace(':id', String(recordId))
              .replace(':action', actionName)
            const body =
              method === 'POST' || method === 'PUT'
                ? actionRoute && name.endsWith('.actions.store') && !categoryResource
                  ? JSON.stringify({ ids: [recordId] })
                  : JSON.stringify({})
                : undefined
            const response = await fetch(`${fixture.baseUrl}${path}`, {
              method,
              headers: {
                Accept: 'application/json',
                ...(body ? { 'Content-Type': 'application/json' } : {}),
              },
              ...(body ? { body } : {}),
            })
            const expected = categoryResource && actionRoute ? 404 : 403
            assert.equal(
              response.status,
              expected,
              `${method} ${route.pattern} (${name}, ${ability}): ${await response.text()}`
            )
            allowPolicyAbilities()
          }
        }
      }

      denyPolicyAbility('viewAny')
      denyCategoryPolicyAbility('viewAny')
      const deniedDashboard = await fetch(`${fixture.baseUrl}/admin`, {
        headers: { Accept: 'application/json' },
        redirect: 'manual',
      })
      assert.equal(deniedDashboard.status, 404)
      allowPolicyAbilities()

      denyPolicyAbility('create')
      const deniedUpload = await fetch(`${fixture.baseUrl}/admin/_pupitre/upload`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams({ resource: 'posts', field: 'cover' }),
      })
      assert.equal(deniedUpload.status, 403, await deniedUpload.text())
      allowPolicyAbilities()

      denyPolicyAbility('update')
      const deniedExistingRecordUpload = await fetch(`${fixture.baseUrl}/admin/_pupitre/upload`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams({
          resource: 'posts',
          field: 'cover',
          record: String(post.id),
        }),
      })
      assert.equal(deniedExistingRecordUpload.status, 403)
      allowPolicyAbilities()
      denyPolicyAbility('viewAny')
      const deniedRecordProbe = await fetch(`${fixture.baseUrl}/admin/_pupitre/upload`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams({
          resource: 'posts',
          field: 'cover',
          record: '999999',
        }),
      })
      assert.equal(deniedRecordProbe.status, 403, await deniedRecordProbe.text())
      allowPolicyAbilities()

      denyPolicyAbility('viewAny')
      denyCategoryPolicyAbility('viewAny')
      const deniedHtml = await fetch(`${fixture.baseUrl}/admin/posts`, {
        headers: { Accept: 'text/html', Referer: '/admin/posts' },
        redirect: 'manual',
      })
      assert.equal(deniedHtml.status, 302, await deniedHtml.text())
      assert.equal(deniedHtml.headers.get('location'), '/admin/posts')
      allowPolicyAbilities()
      const unownedUpload = await fetch(`${fixture.baseUrl}/admin/_pupitre/upload`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'not-owned' }),
      })
      assert.equal(unownedUpload.status, 403)

      const outOfScope = await Post.create({
        title: 'Out of scope matrix post',
        slug: `authz-out-of-scope-${Date.now()}`,
        status: 'draft',
        tenantId: 2,
      })
      const hiddenRecord = await fetch(`${fixture.baseUrl}/admin/posts/${outOfScope.id}`, {
        headers: { Accept: 'application/json' },
      })
      assert.equal(hiddenRecord.status, 404)
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })
})
