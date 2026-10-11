import type { ApplicationService } from '@adonisjs/core/types'
import PupitreManager from '../../../src/manager.js'
import { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { pageProps } from '../../../catalog/wire.js'
import { definePanel, nav } from '../../../index.js'
import {
  closeTestApp,
  createTestApp,
  fixtureCategoryResource,
  fixturePostResource,
  User,
} from '../../helpers/app.js'

async function inertia(baseUrl: string, path: string, host?: string, cookie?: string) {
  return fetch(`${baseUrl}${path}`, {
    headers: {
      'Accept': 'text/html',
      'X-Inertia': 'true',
      'X-Inertia-Version': '1',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(host ? { Host: host } : {}),
    },
  })
}
test('fails at boot for an unknown explicit navigation slug', async ({ assert }) => {
  const manager = new PupitreManager({} as ApplicationService)
  const error = await manager
    .boot([
      definePanel('admin')
        .resources([fixturePostResource])
        .navigation([nav.group('Content').items(['missing-resource'])]),
    ] as never)
    .then(
      () => null,
      (cause: unknown) => cause
    )
  assert.instanceOf(error, Error)
  if (error instanceof Error)
    assert.include(error.message, 'Unknown Pupitre navigation slug \"missing-resource\"')
})

async function props(response: Response) {
  const body = (await response.json()) as { props: unknown }
  return pageProps.parse(body.props)
}

const settingsPage = {
  slug: 'settings',
  path: '/settings',
  title: 'Settings',
  actions: [],
  canAccess: () => true,
  toJSON: () => '{"slug":"settings"}',
}

class NavigationPolicy {
  viewAny(user: User) {
    return user.name === 'Navigation allowed'
  }
}

test.group('Pupitre navigation', () => {
  test('snapshots explicit navigation for users with different permissions', async ({ assert }) => {
    const panel = definePanel('admin')
      .path('/admin')
      .guard('web')
      .resources([
        fixturePostResource.policy(NavigationPolicy),
        fixtureCategoryResource.policy(NavigationPolicy),
      ])
      .pages([settingsPage])
      .navigation([
        nav
          .group('Content')
          .sort(1)
          .collapsible()
          .items([
            nav
              .item()
              .resource('posts')
              .badge(() => 3),
            'categories',
            nav.item('Settings').page('settings'),
          ]),
        nav.item('Documentation').url('https://docs.example.test').external(),
      ])
      .userMenu([
        {
          label: 'Visible action',
          url: '/admin/profile',
          visible: (ctx) => ctx.pupitre.user?.name === 'Navigation allowed',
        },
        { label: 'Hidden action', url: '/admin/hidden', visible: false },
      ])
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const allowedUser = await User.create({
        name: 'Navigation allowed',
        email: 'nav-allowed@example.test',
      })
      const deniedUser = await User.create({
        name: 'Navigation denied',
        email: 'nav-denied@example.test',
      })
      const allowedCookie = await fixture.loginAs(allowedUser)
      const deniedCookie = await fixture.loginAs(deniedUser)
      const allowed = await props(
        await inertia(fixture.baseUrl, '/admin/settings', undefined, allowedCookie)
      )
      const denied = await props(
        await inertia(fixture.baseUrl, '/admin/settings', undefined, deniedCookie)
      )
      const allowedLabels = allowed.pupitre.nav.flatMap((group) =>
        group.items.map((item) => item.label)
      )
      const deniedLabels = denied.pupitre.nav.flatMap((group) =>
        group.items.map((item) => item.label)
      )
      assert.include(allowedLabels, 'Posts')
      assert.include(allowedLabels, 'Categories')
      assert.notInclude(deniedLabels, 'Posts')
      assert.notInclude(deniedLabels, 'Categories')
      assert.snapshot({ nav: allowed.pupitre.nav, menu: allowed.pupitre.panel.userMenu }).match()
      assert.snapshot({ nav: denied.pupitre.nav, menu: denied.pupitre.panel.userMenu }).match()
      assert.notDeepEqual(
        { nav: allowed.pupitre.nav, menu: allowed.pupitre.panel.userMenu },
        { nav: denied.pupitre.nav, menu: denied.pupitre.panel.userMenu }
      )
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('restricts domain panels by Host and keeps panel paths distinct', async ({ assert }) => {
    const admin = definePanel('admin')
      .path('/admin')
      .domain('admin.example.test')
      .resources([fixturePostResource])
    const app = definePanel('app').path('/app').resources([fixtureCategoryResource])
    const fixture = await createTestApp({
      panels: {
        admin: async () => ({ default: admin }),
        app: async () => ({ default: app }),
      },
    })
    try {
      const adminPage = await new ApiClient(fixture.baseUrl)
        .get('/admin/posts')
        .header('Accept', 'text/html')
        .header('X-Inertia', 'true')
        .header('X-Inertia-Version', '1')
        .header('Host', 'admin.example.test')
        .send()
      const wrongDomain = await new ApiClient(fixture.baseUrl)
        .get('/admin/posts')
        .header('Accept', 'text/html')
        .header('X-Inertia', 'true')
        .header('X-Inertia-Version', '1')
        .header('Host', 'other.example.test')
        .send()
      const appPage = await inertia(fixture.baseUrl, '/app/categories')
      assert.equal(adminPage.status(), 200)
      assert.notEqual(wrongDomain.status(), 200)
      assert.equal(appPage.status, 200)
      assert.equal(pageProps.parse(adminPage.body().props).pupitre.panel.id, 'admin')
      const appProps = await props(appPage)
      assert.equal(appProps.pupitre.panel.id, 'app')
      const router = await fixture.app.container.make('router')
      const routeNames = Object.values(router.toJSON())
        .flat()
        .map((route) => route.name)
      assert.include(routeNames, 'admin.posts.list')
      assert.include(routeNames, 'app.categories.list')
    } finally {
      await closeTestApp(fixture)
    }
  })
})
