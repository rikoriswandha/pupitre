import { test } from '@japa/runner'
import {
  actions,
  definePanel,
  definePlugin,
  defineWidget,
  nav,
  schema,
  stat,
  t,
} from '../../index.js'
import {
  closeTestApp,
  createTestApp,
  fixtureCategoryResource,
  fixturePostResource,
  Post,
  User,
} from '../helpers/app.js'
import { pageProps } from '../../catalog/wire.js'
import { createJobContext } from '../../src/jobs/job_context.js'
import { compileValidator } from '../../src/compiler/vine_compiler.js'
import PupitreContextMiddleware from '../../src/http/middleware/pupitre_context.js'
import { requestMessages, getMessages, stripTranslationMarkers } from '../../src/i18n.js'
import { compileInfolist } from '../../src/compiler/schema_compiler.js'
import { buildTableData } from '../../src/table/table_data.js'
import { defineResource, definePage, table } from '../../index.js'
import type { HttpContext } from '@adonisjs/core/http'
import { Table } from '../../src/builder/table/table.js'
import { resolveTranslations } from '../../src/i18n.js'

function assertResolved(
  value: unknown,
  assert: { isFalse(value: boolean, message?: string): void },
  path = 'response'
): void {
  if (typeof value === 'string')
    assert.isFalse(/[\u{E0001}\u{E0002}]/u.test(value), `Unresolved translation at ${path}`)
  else if (value && typeof value === 'object')
    for (const [key, item] of Object.entries(value)) assertResolved(item, assert, `${path}.${key}`)
}

test.group('localized response boundaries', () => {
  test('subdivision flag record data round-trips through list, edit save and CSV', async ({
    assert,
  }) => {
    const flag = 'England 🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}'
    const panel = definePanel('admin')
      .path('/admin')
      .locales(['en', 'id'])
      .resources([
        fixturePostResource
          .table((definition) => definition.columns([table.text('title')]).paginated(false))
          .actions({ header: [actions.export()] }),
      ])
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const post = await Post.create({ title: flag, slug: 'flag', status: 'draft', tenantId: 1 })
      for (const path of ['/admin/posts', `/admin/posts/${post.id}/edit`]) {
        const response = await fetch(`${fixture.baseUrl}${path}`, {
          headers: { 'X-Inertia': 'true', 'X-Inertia-Version': '1', 'Accept-Language': 'id' },
        })
        assert.equal(response.status, 200)
        const page = (await response.json()) as {
          props: { page: { state: { data: { title: string } } } }
        }
        assert.include(JSON.stringify(page), flag)
        if (path.endsWith('/edit')) {
          const saved = await fetch(`${fixture.baseUrl}/admin/posts/${post.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            redirect: 'manual',
            body: JSON.stringify({
              title: page.props.page.state.data.title,
              slug: 'flag',
              status: 'draft',
            }),
          })
          assert.isBelow(saved.status, 400)
        }
      }
      await post.refresh()
      assert.equal(post.title, flag)
      const csv = await fetch(`${fixture.baseUrl}/admin/posts/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Language': 'id',
        },
        body: JSON.stringify({ ids: [post.id] }),
      })
      assert.equal(csv.status, 200)
      assert.include(await csv.text(), flag)
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('shared accessor props resolve once and resolved Inertia pages are not copied on send', async ({
    assert,
  }) => {
    const panel = definePanel('admin').path('/admin').locales(['en', 'id'])
    let samePage = false
    let reads = 0
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      setup(router) {
        router
          .get('/accessor-props', async (ctx) => {
            await new PupitreContextMiddleware({ requireUser: false }).handle(ctx, async () => {
              ctx.inertia.share({
                host: {
                  get label() {
                    reads++
                    return t('Save')
                  },
                },
              } as never)
              const page = await ctx.inertia.page('pupitre' as never, {} as never)
              ctx.response.send(page)
              samePage = ctx.response.getBody() === page
            })
          })
          .as('admin.accessor-props')
      },
    })
    try {
      const response = await fetch(`${fixture.baseUrl}/accessor-props`, {
        headers: { 'Accept-Language': 'id' },
      })
      assert.equal(response.status, 200)
      const page = (await response.json()) as { props: { host: { label: string } } }
      assert.equal(page.props.host.label, 'Simpan')
      assert.equal(reads, 1)
      assert.isTrue(samePage)
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('resource list/edit/view, action modal, dashboard and auth responses contain no markers', async ({
    assert,
  }) => {
    const panel = definePanel('admin')
      .path('/admin')
      .login()
      .locales(['en', 'id'])
      .resources([fixturePostResource])
      .widgets([
        defineWidget('localized-stats')
          .stats(() => [stat(t('Save'), '42')])
          .lazy(false),
      ])
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { auth: { model: async () => ({ default: User }), columns: { name: 'name' } } },
    })
    try {
      const post = await Post.create({ title: 'Save', slug: 'save', status: 'draft', tenantId: 1 })
      const user = await User.create({
        name: 'Boundary User',
        email: 'boundary@example.test',
        password: 'password',
      })
      const cookie = await fixture.loginAs(user)
      for (const path of [
        '/admin/posts',
        `/admin/posts/${post.id}/edit`,
        `/admin/posts/${post.id}`,
        `/admin/posts/${post.id}/actions/publish`,
        '/admin',
        '/admin/login',
      ]) {
        const response = await fetch(`${fixture.baseUrl}${path}`, {
          headers: {
            'Accept': 'text/html',
            'X-Inertia': 'true',
            'X-Inertia-Version': '1',
            'Accept-Language': 'id-ID',
            ...(path === '/admin/login' ? {} : { Cookie: cookie }),
          },
        })
        const raw = await response.text()
        assert.equal(response.status, 200, `${path}: ${raw}`)
        const body: unknown = JSON.parse(raw)
        assertResolved(body, assert, path)
        if (!path.includes('/actions/')) {
          const parsed = body as { props: unknown }
          const props = pageProps.parse(parsed.props)
          assert.equal(props.pupitre.locale, 'id')
        }
      }
      const validation = await fetch(`${fixture.baseUrl}/admin/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cookie': cookie,
          'Accept-Language': 'id',
        },
        body: JSON.stringify({ title: '', slug: '' }),
      })
      assert.equal(validation.status, 422)
      const errors = await validation.json()
      assertResolved(errors, assert)
      assert.include(JSON.stringify(errors), 'wajib diisi')
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('expired sessions return a resolved Indonesian 401 before request context exists', async ({
    assert,
  }) => {
    const panel = definePanel('admin')
      .path('/admin')
      .guard('web')
      .login()
      .locales(['en', 'id'])
      .resources([fixturePostResource])
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { auth: { model: async () => ({ default: User }) } },
    })
    try {
      const response = await fetch(`${fixture.baseUrl}/admin/posts`, {
        headers: { 'Accept': 'application/json', 'Accept-Language': 'id', 'X-Pupitre-Action': '1' },
      })
      assert.equal(response.status, 401)
      const body = await response.json()
      assertResolved(body, assert)
      assert.include(JSON.stringify(body), 'masuk')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('queued validation uses the captured locale and field names', async ({ assert }) => {
    const panel = definePanel('admin')
      .path('/admin')
      .locales(['en', 'id'])
      .resources([fixturePostResource])
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { auth: { model: async () => ({ default: User }), columns: { name: 'name' } } },
    })
    try {
      const user = await User.create({
        name: 'Job User',
        email: 'locale-job@example.test',
        password: 'password',
      })
      const manager = await fixture.app.container.make('pupitre.manager')
      const { ctx } = await createJobContext(manager, {
        panelId: 'admin',
        resource: 'posts',
        userId: user.id,
        tenantId: null,
        locale: 'id',
      })
      const nodes = [
        schema
          .repeater('items')
          .schema((fields) => [fields.text('title').required()])
          .toDefinition(),
      ]
      try {
        await compileValidator(nodes).validate({ items: [{}] }, { ctx, timezone: 'UTC' })
        assert.fail('Expected required field validation')
      } catch (error) {
        if (!error || typeof error !== 'object' || !('messages' in error)) throw error
        assert.include(JSON.stringify(error.messages), 'Title wajib diisi')
        assert.notInclude(JSON.stringify(error.messages), 'items.*.title wajib')
      }
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('nested middleware safely localizes a readonly marker-bearing DOMException', async ({
    assert,
  }) => {
    const failure = new DOMException(t('Save'), 'TimeoutError')
    const panel = definePanel('admin').path('/admin').locales(['en', 'id'])
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      setup(router) {
        router
          .get('/readonly-error', async (ctx) => {
            try {
              await new PupitreContextMiddleware({ requireUser: false }).handle(ctx, async () => {
                throw failure
              })
            } catch (error) {
              return ctx.response.internalServerError({
                sameError: error === failure,
                message: error instanceof Error ? error.message : '',
              })
            }
          })
          .as('admin.readonly-error')
      },
    })
    try {
      const response = await fetch(`${fixture.baseUrl}/readonly-error`, {
        headers: { 'Accept': 'application/json', 'Accept-Language': 'id' },
      })
      assert.equal(response.status, 500)
      assert.deepEqual(await response.json(), { sameError: true, message: 'Simpan' })
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('plugin groups sort by localized labels and merge marked/plain source group names', async ({
    assert,
  }) => {
    const plugin = definePlugin({
      name: 'locale-navigation',
      navigation: [
        nav.group(t('System')).items(['posts']),
        nav.group(t('Settings')).items(['categories']),
      ],
    })
    const panel = definePanel('admin')
      .path('/admin')
      .locales(['en', 'id'])
      .resources([fixturePostResource, fixtureCategoryResource])
      .plugins([plugin])
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      for (const [locale, labels] of [
        ['en', ['Settings', 'System']],
        ['id', ['Pengaturan', 'Sistem']],
      ] as const) {
        const response = await fetch(`${fixture.baseUrl}/admin/posts`, {
          headers: {
            'Accept': 'text/html',
            'X-Inertia': 'true',
            'X-Inertia-Version': '1',
            'Accept-Language': locale,
          },
        })
        const raw = (await response.json()) as { props: unknown }
        const props = pageProps.parse(raw.props)
        assert.deepEqual(
          props.pupitre.nav.map((group) => group.label),
          [...labels]
        )
      }
    } finally {
      await closeTestApp(fixture)
    }

    const mergedPanel = definePanel('admin')
      .path('/admin')
      .locales(['en', 'id'])
      .resources([fixturePostResource, fixtureCategoryResource])
      .navigation([nav.group('System').items(['categories'])])
      .plugins([
        definePlugin({
          name: 'merge-navigation',
          navigation: [nav.group(t('System')).items(['posts'])],
        }),
      ])
    const mergedFixture = await createTestApp({
      panels: { admin: async () => ({ default: mergedPanel }) },
    })
    try {
      const response = await fetch(`${mergedFixture.baseUrl}/admin/posts`, {
        headers: {
          'Accept': 'text/html',
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
          'Accept-Language': 'en',
        },
      })
      const raw = (await response.json()) as { props: unknown }
      const props = pageProps.parse(raw.props)
      assert.lengthOf(props.pupitre.nav, 1)
      assert.lengthOf(props.pupitre.nav[0].items, 2)
      assert.equal(props.pupitre.nav[0].label, 'System')
    } finally {
      await closeTestApp(mergedFixture)
    }
  })
  test('full-page props resolve before JSON serialization and never inject translated script text', async ({
    assert,
  }) => {
    const hostile = '</script><script>window.pupitreXss=1</script>"'
    const panel = definePanel('admin').path('/admin').locales(['en', 'id'])
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { i18n: { messages: { id: { 'Hello {name}': 'Halo "{name}"' } } } },
      setup(router) {
        router
          .get('/localized-html', async (ctx) => {
            await new PupitreContextMiddleware({ requireUser: false }).handle(ctx, async () => {
              ctx.inertia.share({
                errors: ctx.inertia.always({ name: t('Hello {name}', { name: hostile }) }),
              })
              // The fixture supplies an Edge-compatible view renderer without a provider.
              const context = ctx as HttpContext & {
                view: { render(name: string, props: unknown): Promise<string> }
              }
              context.view.render = async (_name, props) => {
                if (!props || typeof props !== 'object' || !('page' in props))
                  throw new Error('Missing page')
                return `<script data-page type="application/json">${JSON.stringify(props.page).replace(/\//g, '\\/')}</script>`
              }
              return ctx.response.send(
                await ctx.inertia.render(
                  'pupitre' as never,
                  { greeting: t('Hello {name}', { name: hostile }) } as never
                )
              )
            })
          })
          .as('admin.localized-html')
        router
          .get('/serialized-html', async (ctx) => {
            await new PupitreContextMiddleware({ requireUser: false }).handle(ctx, async () => {
              return ctx.response.send(
                `<script type="application/json">${JSON.stringify({ greeting: t('Hello {name}', { name: hostile }) }).replace(/\//g, '\\/')}</script>`
              )
            })
          })
          .as('admin.serialized-html')
      },
    })
    try {
      const response = await fetch(`${fixture.baseUrl}/localized-html`, {
        headers: { 'Accept-Language': 'id' },
      })
      assert.equal(response.status, 200)
      const html = await response.text()
      assert.notInclude(html, '</script><script>')
      assert.equal(stripTranslationMarkers(html), html)
      const page = JSON.parse(html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>')))
      assert.equal(page.props.greeting, `Halo "${hostile}"`)
      assert.equal(page.props.errors.name, `Halo "${hostile}"`)
      const serialized = await fetch(`${fixture.baseUrl}/serialized-html`, {
        headers: { 'Accept-Language': 'id' },
      })
      const raw = await serialized.text()
      assert.notInclude(raw, '</script><script>')
      assert.equal(stripTranslationMarkers(raw), raw)
      assert.include(raw, 'Hello ')
      assert.notInclude(raw, 'Halo')
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('option labels resolve before limits and boolean cells use state rather than date prepositions', async ({
    assert,
  }) => {
    const panel = definePanel('admin').path('/admin').locales(['en', 'id'])
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const record = await Post.create({ title: 'Raw', slug: 'limited', status: 'draft' })
      const ctx = { pupitre: { locale: 'id' } } as HttpContext
      requestMessages.set(ctx, getMessages({}, undefined, 'id'))
      const data = await buildTableData(
        new Table(fixturePostResource.toDefinition().table!)
          .columns([
            table
              .text('status')
              .options({ draft: t('Draft') })
              .limit(3),
            table.toggle('enabled'),
          ])
          .toDefinition(),
        [
          { $primaryKeyValue: record.id, serialize: () => ({ status: 'draft', enabled: true }) },
        ] as never,
        undefined,
        {
          ctx,
          locale: 'id',
          timezone: 'UTC',
          normalized: {},
          rowActions: async () => [],
          rowUrl: () => undefined,
        }
      )
      assert.include(JSON.stringify(data.rows[0]), 'Dra…')
      const entry = await compileInfolist(
        [
          schema
            .textEntry('status')
            .options({ draft: t('Draft') })
            .limit(3)
            .toDefinition(),
        ],
        { ctx, locale: 'id', timezone: 'UTC', record: { status: 'draft' } }
      )
      assert.include(JSON.stringify(entry.spec), 'Dra…')
      const localized = resolveTranslations(data, 'id', requestMessages.get(ctx))
      assert.include(JSON.stringify(localized), 'Aktif')
      assert.notInclude(JSON.stringify(localized), 'Pada')
      assertResolved(localized, assert)
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('locale is reserved for custom-page slugs, paths and resources before route registration', async ({
    assert,
  }) => {
    for (const panel of [
      definePanel('admin').pages([definePage('locale').path('/custom')]),
      definePanel('admin').pages([definePage('custom').path('/locale')]),
      definePanel('admin').resources([defineResource(Post).slug('locale')]),
    ]) {
      await assert.rejects(
        () =>
          createTestApp({
            panels: { admin: async () => ({ default: panel.locales(['en', 'id']) }) },
          }),
        /reserved for a built-in route/
      )
    }
  })
})
