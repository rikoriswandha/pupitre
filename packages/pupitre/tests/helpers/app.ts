import { defineConfig as defineAuthConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import { Bouncer } from '@adonisjs/bouncer'
import { defineConfig as defineSessionConfig } from '@adonisjs/session'
import { defineConfig as defineShieldConfig } from '@adonisjs/shield'
import { ExceptionHandler } from '@adonisjs/core/http'
import { defineConfig as defineViteConfig } from '@adonisjs/vite'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createServer, type Server as NodeServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IgnitorFactory } from '@adonisjs/core/factories'
import type { ApplicationService } from '@adonisjs/core/types'
import type { Database } from '@adonisjs/lucid/database'
import { BaseModel } from '@adonisjs/lucid/orm'
import { defineConfig as defineDriveConfig, services as driveServices } from '@adonisjs/drive'
import { defineConfig as defineLucidConfig } from '@adonisjs/lucid'
import { actions, action, definePanel, defineResource, pages, schema, table } from '../../index.js'
import { defineConfig } from '../../src/define_config.js'
import type { PupitreConfigInput } from '../../src/define_config.js'
import type { HttpRouterService } from '@adonisjs/core/types'
import Post from '../fixtures/models/post.js'
import Category from '../fixtures/models/category.js'
import User from '../fixtures/models/user.js'
import { setupDatabase } from './db.js'
class TestInertiaMiddleware extends BaseInertiaMiddleware {
  share(ctx: HttpContext) {
    return { errors: ctx.inertia.always(this.getValidationErrors(ctx)) }
  }

  async handle(ctx: HttpContext, next: NextFn) {
    const context = ctx as HttpContext & {
      view?: {
        render(name: string, props: unknown): Promise<string>
        share(props: Record<string, unknown>): void
      }
    }
    context.view ??= {
      async render() {
        return '<html><body></body></html>'
      },
      share() {},
    }
    await this.init(ctx)
    const output = await next()
    this.dispose(ctx)
    return output
  }
}
class TestExceptionHandler extends ExceptionHandler {
  protected debug = false
}
class TestBouncerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { auth } = ctx as unknown as {
      auth: { user?: unknown; use(name: string): { user?: unknown } }
    }
    const bouncer = new Bouncer(
      () => auth.user ?? auth.use('web').user ?? { id: 1 },
      undefined,
      {}
    ).setContainerResolver(ctx.containerResolver)
    ;(ctx as HttpContext & { bouncer: unknown }).bouncer = bouncer
    return next()
  }
}
export async function testSessionAuthentication(ctx: HttpContext, next: NextFn) {
  const context = ctx as unknown as Omit<HttpContext, 'auth' | 'session'> & {
    auth: { authenticate(): Promise<unknown> }
    session: { get(key: string): unknown }
  }
  if (context.session.get('auth_web') !== undefined) await context.auth.authenticate()
  return next()
}
const deniedAbilities = new Set<string>()
const deniedCategoryAbilities = new Set<string>()
export function denyPolicyAbility(ability: string) {
  deniedAbilities.add(ability)
}
export function denyCategoryPolicyAbility(ability: string) {
  deniedCategoryAbilities.add(ability)
}
export function allowPolicyAbilities() {
  deniedAbilities.clear()
  deniedCategoryAbilities.clear()
}

export class PostPolicy {
  viewAny(_user: unknown) {
    return !deniedAbilities.has('viewAny')
  }
  view(_user: unknown, record: Post) {
    return record.id > 0 && !deniedAbilities.has('view')
  }
  create(_user: unknown) {
    return !deniedAbilities.has('create')
  }
  update(_user: unknown, record: Post) {
    return record.id > 0 && !deniedAbilities.has('update')
  }
  delete(_user: unknown) {
    return !deniedAbilities.has('delete')
  }
  publish(_user: unknown) {
    return !deniedAbilities.has('publish')
  }
}

export class CategoryPolicy {
  viewAny() {
    return !deniedCategoryAbilities.has('viewAny')
  }
  view() {
    return !deniedCategoryAbilities.has('view')
  }
  create() {
    return !deniedCategoryAbilities.has('create')
  }
  update() {
    return !deniedCategoryAbilities.has('update')
  }
  delete() {
    return !deniedCategoryAbilities.has('delete')
  }
}
const fixtureHookEvents: string[] = []
let failAfterSave = false
let failAfterCreate = false

export function fixtureHookEventsSnapshot() {
  return [...fixtureHookEvents]
}

export function resetFixtureHooks() {
  fixtureHookEvents.length = 0
  failAfterSave = false
  failAfterCreate = false
}

export function failFixtureAfterSave(value = true) {
  failAfterSave = value
}

export function failFixtureAfterCreate(value = true) {
  failAfterCreate = value
}

export const fixtureArchiveAction = action('archive')
  .label('Archive')
  .fillForm(() => ({ reason: 'fixture reason' }))
  .form([schema.text('reason').required()])
  .handle(async ({ record, notify }) => {
    if (record) await (record as Post).merge({ status: 'archived' }).save()
    notify?.success('Archived').send()
  })
  .after(({ refresh }) => refresh.table())
  .deselectAfter()
  .keyBindings(['mod+shift+a'])

export const fixtureBulkArchiveAction = actions
  .bulk('bulk-archive')
  .label('Archive selected')
  .handle(async ({ records }) => {
    for (const record of records ?? []) await (record as Post).merge({ status: 'archived' }).save()
  })

export const fixturePublishAction = action('publish')
  .label('Publish')
  .deepLinkable()
  .can('publish')
  .fillForm(() => ({ reason: 'fixture reason' }))
  .form([schema.text('reason').required()])
  .modal({
    footerActions: [
      action('publish-preview')
        .label('Preview publish')
        .handle(({ data, notify }) => {
          notify?.info(`Preview: ${String(data?.reason ?? 'ready')}`).send()
        }),
    ],
  })
  .handle(async ({ record, notify }) => {
    if (record) await (record as Post).merge({ status: 'published' }).save()
    notify?.success('Published').send()
  })
export const fixtureRateLimitAction = action('rate-limit')
  .label('Rate limit')
  .can('publish')
  .rateLimit(2, { per: '1 minute', by: 'user' })
  .handle(({ notify }) => {
    notify?.success('Rate-limited action ran').send()
  })

export const fixtureRecordHeaderAction = action('record-header')
  .label('Record header')
  .deepLinkable()
  .can('publish')
  .form([schema.text('reason').required()])
  .fillForm(({ record }) => ({ reason: (record as Post | null)?.title ?? 'header' }))
  .handle(async ({ notify }) => {
    notify?.success('Header action ran').send()
  })

export const fixturePostResource = defineResource(Post)
  .slug('posts')
  .label('Post')
  .recordTitle('title')
  .policy(PostPolicy)
  .scope((query) => query.where('tenant_id', 1))
  .create((data, _ctx, trx) => Post.create(data, { client: trx }))
  .update(async (record, data, _ctx, trx) => {
    record.useTransaction(trx)
    return record.merge(data).save()
  })
  .mutateBeforeCreate((data) => {
    fixtureHookEvents.push('mutateBeforeCreate')
    return { ...data, tenantId: 1 }
  })
  .beforeCreate(() => fixtureHookEvents.push('beforeCreate'))
  .afterCreate(() => {
    fixtureHookEvents.push('afterCreate')
    if (failAfterCreate) throw new Error('fixture afterCreate failure')
  })
  .mutateBeforeSave((data) => {
    fixtureHookEvents.push('mutateBeforeSave')
    return data
  })
  .beforeSave(() => fixtureHookEvents.push('beforeSave'))
  .afterSave(() => {
    fixtureHookEvents.push('afterSave')
    if (failAfterSave) throw new Error('fixture afterSave failure')
  })
  .beforeDelete((record) => fixtureHookEvents.push(`beforeDelete:${(record as Post).id}`))
  .afterDelete((record) => fixtureHookEvents.push(`afterDelete:${(record as Post).id}`))
  .form((form) =>
    form.components([
      schema.text('title').required().maxLength(200),
      schema.text('slug').required(),
      schema.select('status').options({ draft: 'Draft', published: 'Published' }),
      schema.tabs([
        schema.tab('Media').components([schema.fileUpload('cover').image().maxSize('2mb')]),
      ]),
      schema.fileUpload('privateCover').visibility('private').image().maxSize('2mb'),
      schema.richEditor('body'),
      schema
        .repeater('items')
        .schema((fields) => [fields.fileUpload('attachment').image().maxSize('2mb')]),
      schema
        .repeater('links')
        .schema((fields) => [fields.text('label').required(), fields.text('url').url().required()])
        .relationship('links', { orderColumn: 'sort' }),
    ])
  )
  .table((definition) =>
    definition
      .columns([
        table.text('title').sortable().searchable({ individually: true }),
        table.text('category.name'),
        table.text('metadata.title'),
        table.badge('status'),
        table.image('cover'),
      ])
      .filters([table.filter.select('status').options({ draft: 'Draft', published: 'Published' })])
      .paginated([1, 10])
  )
  .infolist((definition) =>
    definition.components([
      schema.textEntry('title'),
      schema.textEntry('status'),
      schema.imageEntry('cover'),
    ])
  )
  .actions({
    header: [actions.create(), fixtureRecordHeaderAction],
    row: [fixturePublishAction, fixtureArchiveAction, fixtureRateLimitAction],
    bulk: [actions.delete(), fixtureBulkArchiveAction],
  })
  .pages({
    list: pages.list().tabs({
      all: { label: 'All' },
      draft: { label: 'Draft', where: { status: 'draft' } },
    }),
    create: pages.create(),
    edit: pages.edit(),
    view: pages.view(),
  })

export const fixtureCategoryResource = defineResource(Category)
  .slug('categories')
  .label('Category')
  .pluralLabel('Categories')
  .policy(CategoryPolicy)
  .form((form) => form.components([schema.text('name').required()]))
  .table((definition) => definition.columns([table.text('name').sortable()]))
  .infolist((definition) => definition.components([schema.textEntry('name')]))
  .pages({ list: pages.list(), create: pages.create(), edit: pages.edit(), view: pages.view() })

export const fixturePanel = definePanel('admin')
  .path('/admin')
  .middleware([testSessionAuthentication])
  .resources({
    posts: fixturePostResource,
    categories: fixtureCategoryResource,
  })

export const fixturePanels = { admin: async () => ({ default: fixturePanel }) }

export type TestApplication = {
  app: ApplicationService
  database: Database
  testDatabase: Database
  root: string
  storagePath: string
  baseUrl: string
  server: NodeServer
  loginAs(user: User): Promise<string>
}

export type CreateTestAppOptions = {
  csrf?: boolean
  panelGuard?: string
  withoutBouncer?: boolean
  resourceSlug?: string
  breadcrumbs?: boolean
  /** Replaces the fixture panel barrel (`{ admin: async () => ({ default: panel }) }`). */
  panels?: Record<string, () => Promise<{ default: unknown }>>
  /** Merged over the default Pupitre test config. */
  pupitre?: PupitreConfigInput
  /** Extra/overridden application config entries (e.g. `limiter`). */
  config?: Record<string, unknown>
  /** Extra providers appended to the fixture provider list. */
  providers?: (() => Promise<unknown>)[]
  /** Registers extra routes / router middleware before the panels boot. */
  setup?: (router: HttpRouterService, app: ApplicationService) => void | Promise<void>
}

export async function createTestApp(options: CreateTestAppOptions = {}): Promise<TestApplication> {
  const root = await mkdtemp(join(tmpdir(), 'pupitre-http-'))
  const storagePath = join(root, 'uploads')
  await mkdir(storagePath, { recursive: true })
  const testDatabase = await setupDatabase()
  const ignitor = new IgnitorFactory()
    .withCoreConfig()
    .withCoreProviders()
    .merge({
      rcFileContents: {
        providers: [
          () => import('@adonisjs/lucid/database_provider'),
          () => import('@adonisjs/session/session_provider'),
          () => import('@adonisjs/shield/shield_provider'),
          () => import('@adonisjs/auth/auth_provider'),
          () => import('@adonisjs/bouncer/bouncer_provider'),
          () => import('@adonisjs/inertia/inertia_provider'),
          () => import('@adonisjs/vite/vite_provider'),
          () => import('@adonisjs/drive/drive_provider'),
          () => import('../../providers/pupitre_provider.js'),
          ...(options.providers ?? []),
        ],
      },
      config: {
        pupitre: defineConfig({
          cache: { dev: true },
          storage: { disk: 'uploads' },
          ...options.pupitre,
        }),
        database: defineLucidConfig(testDatabase.config),
        session: defineSessionConfig({
          enabled: true,
          store: 'memory',
          stores: {},
          cookieName: 'pupitre-test-session',
          clearWithBrowser: false,
        }),
        shield: defineShieldConfig({
          csrf: {
            enabled: options.csrf ?? false,
            enableXsrfCookie: options.csrf ?? false,
            methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
          },
        }),
        auth: defineAuthConfig({
          default: 'web',
          guards: {
            web: sessionGuard({
              useRememberMeTokens: false,
              provider: sessionUserProvider({ model: () => import('../fixtures/models/user.js') }),
            }),
          },
        }),
        bouncer: {},
        inertia: { rootView: 'inertia_layout', sharedData: {}, ssr: { enabled: false } },
        drive: defineDriveConfig({
          default: 'uploads',
          services: {
            uploads: driveServices.fs({
              location: storagePath,
              serveFiles: true,
              routeBasePath: '/uploads',
              visibility: 'public',
            }),
          },
        }),
        vite: defineViteConfig({
          buildDirectory: 'public/assets',
          manifestFile: 'public/assets/.vite/manifest.json',
        }),
        ...options.config,
      },
    })
    .create(new URL(`file://${root}/`))
  const app = ignitor.createApp('web')
  await app.init()
  await app.boot()
  const applicationDatabase = await app.container.make('lucid.db')
  const router = await app.container.make('router')
  router.use([
    () => import('@adonisjs/core/bodyparser_middleware'),
    () => import('@adonisjs/session/session_middleware'),
    () => import('@adonisjs/shield/shield_middleware'),
    () => import('@adonisjs/auth/initialize_auth_middleware'),
    ...(options.withoutBouncer ? [] : [async () => ({ default: TestBouncerMiddleware })]),
  ])
  router.post('/__test/login', async (ctx) => {
    const user = await User.findOrFail(ctx.request.input('id'))
    const authContext = ctx as unknown as Omit<HttpContext, 'auth'> & {
      auth: { use(name: string): { login(user: User): Promise<void> } }
    }
    await authContext.auth.use('web').login(user)
    return ctx.response.noContent()
  })
  await options.setup?.(router, app)
  const configuredPanel = options.resourceSlug
    ? fixturePanel.resources({
        posts: fixturePostResource.slug(options.resourceSlug),
        categories: fixtureCategoryResource,
      })
    : fixturePanel
  const guardedPanel = options.panelGuard
    ? configuredPanel.guard(options.panelGuard)
    : configuredPanel
  const panels =
    options.panels ??
    (options.resourceSlug || options.panelGuard || options.breadcrumbs === false
      ? {
          admin: async () => ({
            default: guardedPanel.breadcrumbs(options.breadcrumbs ?? true),
          }),
        }
      : fixturePanels)
  const manager = await app.container.make('pupitre.manager')
  await manager.boot(panels as never)
  await app.start(() => {})
  const server = await app.container.make('server')
  server.errorHandler(async () => ({ default: TestExceptionHandler }))
  server.use([async () => ({ default: TestInertiaMiddleware })])
  await server.boot()
  const httpServer = createServer((request, response) => {
    response.setHeader('Connection', 'close')
    return server.handle(request, response)
  })
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(0, '127.0.0.1', resolve)
  })
  const address = httpServer.address()
  if (!address || typeof address === 'string')
    throw new Error('Test HTTP server did not bind to a TCP port')
  const baseUrl = `http://127.0.0.1:${address.port}`
  return {
    app,
    database: applicationDatabase,
    testDatabase,
    root,
    storagePath,
    baseUrl,
    server: httpServer,
    async loginAs(user) {
      const cookies = new Map<string, string>()
      let xsrfToken: string | undefined
      if (options.csrf) {
        const bootstrap = await fetch(`${baseUrl}/admin/categories`, {
          headers: { Accept: 'application/json' },
        })
        for (const cookie of bootstrap.headers.getSetCookie()) {
          const [pair] = cookie.split(';', 1)
          const separator = pair!.indexOf('=')
          if (separator > 0) cookies.set(pair!.slice(0, separator), pair!.slice(separator + 1))
          if (pair?.startsWith('XSRF-TOKEN='))
            xsrfToken = decodeURIComponent(pair.slice('XSRF-TOKEN='.length))
        }
        await bootstrap.arrayBuffer()
      }
      const response = await fetch(`${baseUrl}/__test/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookies.size
            ? { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') }
            : {}),
          ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
        },
        body: JSON.stringify({ id: user.id }),
      })
      if (!response.ok) {
        const responseText = await response.text()
        throw new Error(
          `Unable to log in fixture user (${response.status}): ${responseText}; request cookies=${[...cookies.keys()].join(',')}`
        )
      }
      for (const cookie of response.headers.getSetCookie()) {
        const [pair] = cookie.split(';', 1)
        const separator = pair!.indexOf('=')
        if (separator > 0) cookies.set(pair!.slice(0, separator), pair!.slice(separator + 1))
      }
      return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ')
    },
  }
}

export async function closeTestApp(testApp: TestApplication) {
  testApp.server.closeAllConnections()
  await new Promise<void>((resolve, reject) => {
    testApp.server.close((error) => (error ? reject(error) : resolve()))
  })
  await testApp.app.terminate()
  await testApp.database.manager.closeAll(true)
  BaseModel.useAdapter(testApp.testDatabase.modelAdapter())
  await rm(testApp.root, { recursive: true, force: true })
}

export { Post, Category, User }
