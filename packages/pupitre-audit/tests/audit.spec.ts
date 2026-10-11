import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import { IgnitorFactory } from '@adonisjs/core/factories'
import { BaseModel } from '@adonisjs/lucid/orm'
import { defineResource, pages } from '@rikology/pupitre'
import type { PupitreConfig } from '@rikology/pupitre'
import { audit, authorizeActivity } from '../index.js'

class Post extends BaseModel {}
const resource = defineResource(Post)
  .pages({ list: pages.list(), view: pages.view(), edit: pages.edit() })
  .toDefinition()

test('activity has only list and view pages and no write actions', ({ assert }) => {
  const plugin = audit()
  const activity = plugin.resources[0]
  const definition = activity.toDefinition()
  assert.deepEqual(Object.keys(definition.pages), ['list', 'view'])
  assert.equal(definition.icon, 'activity')
  assert.deepEqual(definition.actions!.header, [])
  assert.deepEqual(definition.actions!.bulk, [])
  assert.equal(definition.actions!.row[0].name, 'view')
  assert.deepEqual(
    definition.table!.filters.map((filter) => filter.name),
    ['event', 'auditableType', 'createdAt']
  )
})

test('timelines append without mutating the original resource', ({ assert }) => {
  const next = audit({ activity: false }).extendResource(resource)!
  assert.isUndefined(resource.pages.view!.footerWidgets)
  assert.equal(next.pages.view!.footerWidgets![0].kind, 'timeline')
  assert.equal(next.pages.edit!.footerWidgets![0].kind, 'timeline')
  assert.deepEqual(audit({ activity: false }).resources, [])
})

test('resource and page allowlists control timeline placement', ({ assert }) => {
  assert.isUndefined(audit({ resources: ['other'] }).extendResource(resource))
  const next = audit({ pages: ['view'] }).extendResource(resource)!
  assert.lengthOf(next.pages.view!.footerWidgets!, 1)
  assert.isUndefined(next.pages.edit!.footerWidgets)
})

test('invalid pagination is rejected', ({ assert }) => {
  for (const perPage of [0, -1, 101, 1.5]) assert.throws(() => audit({ perPage }))
})

test('activity access fails closed without policy or explicit callback', async ({ assert }) => {
  assert.isFalse(await authorizeActivity({} as HttpContext, {}, {} as PupitreConfig))
  assert.isTrue(
    await authorizeActivity({} as HttpContext, { authorize: () => true }, {} as PupitreConfig)
  )
  assert.isFalse(
    await authorizeActivity({} as HttpContext, { authorize: () => false }, {} as PupitreConfig)
  )
})

test('configured activity policy controls list and detail independently', async ({ assert }) => {
  class ActivityPolicy {
    viewAny() {
      return true
    }
    view() {
      return false
    }
  }
  const calls: string[] = []
  const ctx = {
    bouncer: {
      with: () => ({
        allows: async (ability: string) => {
          calls.push(ability)
          return ability === 'viewAny'
        },
      }),
    },
  } as unknown as HttpContext
  const config = {} as PupitreConfig
  config.policies = async () => ({ ActivityPolicy })
  assert.isTrue(await authorizeActivity(ctx, {}, config))
  assert.isFalse(await authorizeActivity(ctx, {}, config, {} as never))
  assert.deepEqual(calls, ['viewAny', 'view'])
})

test('activity date filter uses inclusive UTC days with ISO bounds', ({ assert }) => {
  const definition = audit().resources[0].toDefinition()
  const filter = definition.table!.filters.find((item) => item.name === 'createdAt')!
  if (filter.kind !== 'custom' || !filter.query) throw new Error('Expected date filter')
  const comparisons: unknown[][] = []
  const query = { where: (...args: unknown[]) => comparisons.push(args) } as unknown as Parameters<
    NonNullable<typeof filter.query>
  >[0]
  filter.query(query, { from: '2026-10-11', to: '2026-10-12' })
  assert.deepEqual(comparisons, [
    ['created_at', '>=', '2026-10-11T00:00:00.000Z'],
    ['created_at', '<', '2026-10-13T00:00:00.000Z'],
  ])
})

test('activity inherits Audit UUID identity and consumes SQLite ISO timestamps', ({ assert }) => {
  const model = audit().resources[0].toDefinition().modelClass!
  assert.isTrue(model.selfAssignPrimaryKey)
  const record = model.$createFromAdapterResult({
    id: '01900000-0000-7000-8000-000000000001',
    created_at: '2026-10-11T08:13:34.408Z',
  })!
  assert.equal(record.serialize().createdAt, '2026-10-11T08:13:34.408Z')
})

test('activity callback cannot cross the active tenant boundary', async ({ assert }) => {
  const ctx = { pupitre: { panel: { tenancy: {} }, tenant: { id: 1 } } } as unknown as HttpContext
  assert.isFalse(
    await authorizeActivity(
      ctx,
      { authorize: () => true },
      {} as PupitreConfig,
      { tenantId: '2' } as never
    )
  )
})

test('activity list queries isolate tenant rows and fail closed without a tenant', ({ assert }) => {
  const definition = audit({ authorize: () => true }).resources[0].toDefinition()
  const comparisons: unknown[][] = []
  const query = {
    where: (...args: unknown[]) => comparisons.push(args),
    whereRaw: (...args: unknown[]) => comparisons.push(args),
  } as never
  const scope = definition.table!.query!
  scope(query, { pupitre: { panel: { tenancy: {} }, tenant: { id: 'team-a' } } } as never)
  scope(query, { pupitre: { panel: { tenancy: {} }, tenant: null } } as never)
  assert.deepEqual(comparisons, [['tenant_id', 'team-a'], ['1 = 0']])
})

test('activity does not expose links to absent or nested subject resources', async ({ assert }) => {
  const definition = audit().resources[0].toDefinition()
  const subject = definition.table!.columns.find(
    (column) => column.kind === 'text' && column.name === 'auditableId'
  )!
  if (subject.kind !== 'text') throw new Error('Expected text subject column')
  const url = subject.url as (context: unknown) => Promise<string | undefined>
  const record = { auditableType: 'Post', auditableId: 'foreign' }
  assert.isUndefined(
    await url({
      record,
      ctx: { pupitre: { panel: { resources: [] } } },
    })
  )
  assert.isUndefined(
    await url({
      record,
      ctx: {
        pupitre: {
          panel: {
            resources: [
              {
                model: Post,
                parent: {},
                definition: { pages: { view: {} } },
              },
            ],
          },
        },
      },
    })
  )
})

test('subject links require scoped records and both list and record authorization', async ({
  assert,
  cleanup,
}) => {
  const app = new IgnitorFactory()
    .withCoreConfig()
    .withCoreProviders()
    .create(new URL('../tmp/app/', import.meta.url))
    .createApp('web')
  await app.init()
  await app.boot()
  cleanup(() => app.terminate())
  class Policy {
    viewAny() {
      return true
    }
    view() {
      return true
    }
    update() {
      return true
    }
  }
  const entry = audit()
    .resources[0].toDefinition()
    .table!.columns.find((column) => column.kind === 'text' && column.name === 'auditableId')!
  if (entry.kind !== 'text') throw new Error('Expected text subject column')
  const url = entry.url as (context: unknown) => Promise<string | undefined>
  let allowed = true
  let exists = true
  const scopes: unknown[][] = []
  const subject = { $primaryKeyValue: 9 }
  const model = {
    name: 'Post',
    primaryKey: 'id',
    query: () => ({
      where: (...args: unknown[]) => {
        scopes.push(args)
        return { first: async () => (exists ? subject : null) }
      },
    }),
  }
  const ctx = {
    pupitre: {
      panel: {
        tenancy: {},
        resources: [
          {
            model,
            definition: { policy: Policy, pages: { view: {} } },
            urls: { view: (id: string) => `/admin/posts/${id}` },
          },
        ],
      },
      tenant: { id: 'own' },
      tenancyAdapter: {
        scope: () => {
          scopes.push(['tenant', 'own'])
        },
      },
    },
    bouncer: { with: () => ({ allows: async () => allowed }) },
  }
  const args = { ctx, record: { auditableType: 'Post', auditableId: 9 } }
  assert.equal(await url(args), '/admin/posts/9')
  assert.deepEqual(scopes, [
    ['tenant', 'own'],
    ['id', 9],
  ])
  allowed = false
  assert.isUndefined(await url(args))
  allowed = true
  exists = false
  assert.isUndefined(await url(args))
  exists = true
  Object.assign(ctx.pupitre, { tenant: null })
  assert.isUndefined(await url(args))
})
