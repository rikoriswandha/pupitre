import { test } from '@japa/runner'
import { action, definePanel, defineResource, pages, table } from '@rikology/pupitre'
import type { JobsAdapter } from '../../pupitre/src/adapters/jobs.js'
import type { TenancyAdapter } from '../../pupitre/src/definition/tenancy.js'
import {
  closeTestApp,
  createTestApp,
  testSessionAuthentication,
} from '../../pupitre/tests/helpers/app.js'
import Post from '../../pupitre/tests/fixtures/models/post.js'
import User from '../../pupitre/tests/fixtures/models/user.js'
import Migration from './migration.js'
import { Permission, Role, shield } from '../index.js'

// Only delivery is deferred: the registered production worker, authentication,
// Shield policies and database grants all execute unchanged.
test.group('Shield queued authorization', () => {
  test('resolves policy context and rechecks user grants and tenant access in the worker', async ({
    assert,
  }) => {
    const queued: Record<string, unknown>[] = []
    const handlers = new Map<string, (payload: Record<string, unknown>) => Promise<void>>()
    const jobs: JobsAdapter = {
      register(name, handler) {
        handlers.set(name, handler)
      },
      async dispatch(_name, payload) {
        queued.push(JSON.parse(JSON.stringify(payload)) as Record<string, unknown>)
      },
    }
    const memberships = new Set<string>()
    const tenancy: TenancyAdapter = {
      async listForUser(ctx) {
        const user = ctx.pupitre.authUser as User
        return memberships.has(String(user.id)) ? [{ id: 1, name: 'Acme', slug: 'acme' }] : []
      },
      async resolve(ctx) {
        const available = await this.listForUser(ctx)
        return available.find((tenant) => tenant.slug === ctx.params.tenant) ?? null
      },
      scope(query, tenant, options) {
        query.where(options.ownership, tenant.id)
      },
      fill(data, tenant) {
        return { ...data, tenantId: tenant.id }
      },
    }
    const executed: { userId: number; tenantId: string | number | undefined }[] = []
    const posts = defineResource(Post)
      .slug('posts')
      .table((t) => t.columns([table.text('title')]))
      .actions({
        bulk: [
          action('publish-queued')
            .async()
            .can('publish')
            .handle(async ({ ctx, records }) => {
              executed.push({
                userId: (ctx.pupitre.authUser as User).id,
                tenantId: ctx.pupitre.tenant?.id,
              })
              for (const record of records ?? []) {
                await (record as Post).merge({ status: 'published' }).save()
              }
            }),
        ],
      })
      .pages({ list: pages.list() })
    const panel = definePanel('admin')
      .path('/admin')
      .middleware([testSessionAuthentication])
      .tenancy({ mode: 'url', adapter: tenancy })
      .resources([posts])
      .plugins([shield({ userModel: async () => ({ default: User }), resources: ['posts'] })])
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { jobs },
      setup: async (_router, app) => {
        const database = await app.container.make('lucid.db')
        if (!(await database.connection().schema.hasTable('pupitre_roles')))
          await new Migration(database.connection(), 'shield-queued').execUp()
        for (const name of [
          'pupitre_role_user',
          'pupitre_permission_role',
          'pupitre_permissions',
          'pupitre_roles',
        ])
          await database.from(name).delete()
      },
    })
    try {
      const database = await fixture.app.container.make('lucid.db')
      const actor = await User.create({
        name: 'Queued editor',
        email: 'queued-editor@example.test',
      })
      const other = await User.create({ name: 'Other member', email: 'queued-other@example.test' })
      memberships.add(String(actor.id))
      memberships.add(String(other.id))
      const role = await Role.create({ name: 'queued-editor' })
      const viewAny = await Permission.create({ name: 'posts.viewAny' })
      const publish = await Permission.create({ name: 'posts.publish' })
      await role.related('permissions').attach([viewAny.id, publish.id])
      await database.table('pupitre_role_user').insert({ user_id: actor.id, role_id: role.id })
      const local = await Post.create({
        title: 'Queued local',
        slug: 'queued-local',
        status: 'draft',
        tenantId: 1,
      })
      const foreign = await Post.create({
        title: 'Queued foreign',
        slug: 'queued-foreign',
        status: 'draft',
        tenantId: 2,
      })
      const cookie = await fixture.loginAs(actor)
      const response = await fetch(`${fixture.baseUrl}/admin/acme/posts/actions/publish-queued`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Pupitre-Action': '1',
          'Cookie': cookie,
          'Connection': 'close',
        },
        body: JSON.stringify({ ids: [local.id] }),
      })
      assert.equal(response.status, 200, await response.text())
      assert.lengthOf(queued, 1)
      const payload = queued[0]!
      const worker = handlers.get('pupitre.bulk')
      if (!worker) throw new Error('The production bulk worker was not registered')
      assert.equal(payload.userId, actor.id)
      assert.equal(payload.tenantId, 1)
      await worker(payload)
      await local.refresh()
      assert.equal(local.status, 'published')
      assert.deepEqual(executed, [{ userId: actor.id, tenantId: 1 }])
      await local.merge({ status: 'draft' }).save()

      // A different authenticated tenant member cannot borrow the actor's grants.
      await assert.rejects(() => worker({ ...payload, userId: other.id }), /You are not authorized/)
      // Revocation after dispatch must be observed by a fresh job context.
      await role.related('permissions').detach([publish.id])
      await assert.rejects(() => worker(payload), /You are not authorized/)
      await local.refresh()
      assert.equal(local.status, 'draft')
      await role.related('permissions').attach([publish.id])
      await assert.rejects(
        () => worker({ ...payload, ids: [local.id, foreign.id] }),
        /You are not authorized/
      )
      memberships.delete(String(actor.id))
      await assert.rejects(() => worker(payload), /tenant is no longer available/)
      await foreign.refresh()
      assert.equal(foreign.status, 'draft')
      assert.lengthOf(executed, 1)
    } finally {
      await closeTestApp(fixture)
    }
  })
})
