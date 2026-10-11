import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import { pageProps } from '../../catalog/wire.js'
import { definePanel, definePlugin, nav } from '../../index.js'
import type { PanelRuntime } from '../../src/manager.js'
import {
  closeTestApp,
  createTestApp,
  fixtureCategoryResource,
  fixturePostResource,
  testSessionAuthentication,
  User,
} from '../helpers/app.js'

async function props(baseUrl: string, path: string, cookie: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Accept': 'text/html',
      'X-Inertia': 'true',
      'X-Inertia-Version': '1',
      'Cookie': cookie,
    },
  })
  return { response, body: pageProps.parse(((await response.json()) as { props: unknown }).props) }
}

test.group('plugins', () => {
  test('applies register, contributions, extendResource and boot in declaration order', async ({
    assert,
  }) => {
    const events: string[] = []
    let booted: PanelRuntime | undefined
    const header = (name: string) => async (ctx: HttpContext, next: () => Promise<void>) => {
      events.push(`middleware:${name}`)
      ctx.response.header(`x-plugin-${name}`, '1')
      return next()
    }
    const categories = definePlugin({
      name: 'categories',
      register(panel) {
        events.push('register:categories')
        return panel.brand({ name: 'Plugged' })
      },
      resources: [fixtureCategoryResource],
      middleware: [header('categories')],
      navigation: [nav.group('Taxonomy').items(['categories'])],
      extendResource(resource) {
        events.push(`extend:categories:${resource.slug}`)
        return { ...resource, label: `${resource.label}!` }
      },
      boot({ panel }) {
        events.push('boot:categories')
        booted = panel
      },
    })
    const second = definePlugin({
      name: 'second',
      register() {
        events.push('register:second')
      },
      extendResource(resource) {
        events.push(`extend:second:${resource.slug}`)
      },
      async boot() {
        events.push('boot:second')
      },
    })
    const panel = definePanel('admin')
      .path('/admin')
      .middleware([testSessionAuthentication])
      .resources({ posts: fixturePostResource })
      .plugins([categories, second])
    const context = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      assert.deepEqual(events, [
        'register:categories',
        'register:second',
        'extend:categories:posts',
        'extend:second:posts',
        'extend:categories:categories',
        'extend:second:categories',
        'boot:categories',
        'boot:second',
      ])
      assert.deepEqual(
        booted?.resources.map((resource) => [resource.slug, resource.label]),
        [
          ['posts', 'Post!'],
          ['categories', 'Category!'],
        ]
      )
      const user = await User.create({
        name: 'Plugins',
        email: 'plugins@example.com',
        password: 'secret',
      })
      const cookie = await context.loginAs(user)
      const { response, body } = await props(context.baseUrl, '/admin/categories', cookie)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('x-plugin-categories'), '1')
      assert.equal(body.pupitre.panel.brand.name, 'Plugged')
      // Derived navigation keeps host resources; the plugin group claims `categories`.
      assert.deepEqual(
        body.pupitre.nav.map((group) => [group.label, group.items.map((item) => item.label)]),
        [
          ['Resources', ['Posts']],
          ['Taxonomy', ['Categories']],
        ]
      )
    } finally {
      await closeTestApp(context)
    }
  })

  test('merges plugin navigation into explicit panel navigation by group label', async ({
    assert,
  }) => {
    const plugin = definePlugin({
      name: 'taxonomy',
      resources: [fixtureCategoryResource],
      navigation: [nav.group('Content').items(['categories'])],
    })
    const panel = definePanel('admin')
      .path('/admin')
      .middleware([testSessionAuthentication])
      .resources({ posts: fixturePostResource })
      .navigation([nav.group('Content').items(['posts'])])
      .plugins([plugin])
    const context = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const user = await User.create({
        name: 'Nav',
        email: 'plugins-nav@example.com',
        password: 'secret',
      })
      const cookie = await context.loginAs(user)
      const { body } = await props(context.baseUrl, '/admin/posts', cookie)
      assert.deepEqual(
        body.pupitre.nav.map((group) => [group.label, group.items.map((item) => item.label)]),
        [['Content', ['Posts', 'Categories']]]
      )
    } finally {
      await closeTestApp(context)
    }
  })
})

test.group('definePlugin', () => {
  test('rejects invalid names, unknown keys and non-function hooks', ({ assert }) => {
    assert.throws(() => definePlugin({ name: 'Bad Name' }), /kebab-case/)
    assert.throws(
      () => definePlugin({ name: 'typo', resource: [] } as never),
      /Unknown key "resource"/
    )
    assert.throws(() => definePlugin({ name: 'hook', boot: true } as never), /must be a function/)
  })

  test('rejects duplicate plugins and plugins that change the panel id', async ({ assert }) => {
    const plugin = definePlugin({ name: 'dup' })
    assert.throws(() => definePanel('admin').plugins([plugin, plugin]), /registered twice/)
    const { applyPlugins } = await import('../../src/plugins/apply.js')
    const renaming = definePlugin({
      name: 'rename',
      register: () => definePanel('other'),
    })
    assert.throws(
      () => applyPlugins(definePanel('admin').plugins([renaming]).toDefinition()),
      /cannot change the panel id/
    )
    const nesting = definePlugin({
      name: 'nesting',
      register: (panel) => panel.plugins([definePlugin({ name: 'inner' })]),
    })
    assert.throws(
      () => applyPlugins(definePanel('admin').plugins([nesting]).toDefinition()),
      /cannot register other plugins/
    )
  })
})
