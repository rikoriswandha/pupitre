import { test } from '@japa/runner'
import { pageProps } from '@rikology/pupitre/catalog'
import { manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import DatabaseProvider from '@adonisjs/lucid/database_provider'
import {
  actions,
  action,
  definePanel,
  definePage,
  defineResource,
  pages,
  defineRelationManager,
  table,
} from '@rikology/pupitre'
import {
  closeTestApp,
  createTestApp,
  testSessionAuthentication,
} from '../../pupitre/tests/helpers/app.js'
import Post from '../../pupitre/tests/fixtures/models/post.js'
import User from '../../pupitre/tests/fixtures/models/user.js'
import PostLink from '../../pupitre/tests/fixtures/models/post_link.js'
import Migration from './migration.js'
import {
  shield,
  shieldRolesField,
  shieldCan,
  shieldAllows,
  invalidateShieldPermissions,
  Role,
  Permission,
  syncPermissions,
} from '../index.js'

const options = { userModel: async () => ({ default: User }) }
class ShieldUser extends User {
  static table = 'users'
  @manyToMany(() => Role, {
    pivotTable: 'pupitre_role_user',
    pivotForeignKey: 'user_id',
    pivotRelatedForeignKey: 'role_id',
  })
  declare roles: ManyToMany<typeof Role>
}
class ExplicitUserPolicy {
  viewAny() {
    return true
  }
  view() {
    return true
  }
  create() {
    return true
  }
  update() {
    return true
  }
}
const users = defineResource(ShieldUser)
  .slug('users')
  .form((s) => [s.text('name').required(), s.text('email').required(), shieldRolesField()])
  .table((t) => t.columns([table.text('name')]))
  .actions({ header: [actions.create()], row: [actions.edit()] })
  .pages({ list: pages.list(), create: pages.create(), edit: pages.edit() })
const links = defineResource(PostLink)
  .slug('links')
  .parent(Post, 'post')
  .table((t) => t.columns([table.text('label')]))
  .actions({
    row: [
      action('approve')
        .can('approve')
        .handle(async () => {}),
    ],
  })
  .pages({ list: pages.list() })
const posts = defineResource(Post)
  .slug('posts')
  .form((s) => [s.text('title').required(), s.text('slug').required(), s.text('status')])
  .table((t) => t.columns([table.text('title')]))
  .actions({
    header: [actions.create()],
    row: [
      actions.edit(),
      actions.delete(),
      action('publish')
        .can('publish')
        .handle(async () => {}),
    ],
  })
  .pages({ list: pages.list(), create: pages.create(), edit: pages.edit() })
  .nested([links])
class ExplicitPolicy {
  viewAny() {
    return true
  }
}
const explicit = defineResource(Post)
  .slug('explicit')
  .policy(ExplicitPolicy)
  .table((t) => t.columns([table.text('title')]))
  .pages({ list: pages.list() })

const reviewRelations = [
  defineRelationManager(Post, 'links').actions({
    row: [
      action('review')
        .can('review')
        .handle(async () => {}),
    ],
  }),
]
async function fixture(explicitUsers = false, withRelations = false) {
  return createTestApp({
    panels: {
      admin: async () => ({
        default: definePanel('admin')
          .path('/admin')
          .middleware([testSessionAuthentication])
          .resources([
            withRelations ? posts.nested([]).relations(reviewRelations) : posts,
            explicit,
            explicitUsers ? users.policy(ExplicitUserPolicy) : users,
            ...(withRelations
              ? [
                  defineResource(PostLink)
                    .slug('links')
                    .table((t) => t.columns([table.text('label')]))
                    .pages({ list: pages.list() }),
                ]
              : []),
          ])
          .pages([definePage('settings').canAccess(shieldCan('settings.access'))])
          .plugins([shield(explicitUsers ? { ...options, resources: ['roles'] } : options)]),
      }),
    },
    setup: async (router, app) => {
      const database = await app.container.make('lucid.db')
      await new DatabaseProvider({ usingVineJS: true } as never).registerVineJSRules(database)
      if (!(await database.connection().schema.hasTable('pupitre_roles')))
        await new Migration(database.connection(), 'shield').execUp()
      for (const name of [
        'pupitre_role_user',
        'pupitre_permission_role',
        'pupitre_permissions',
        'pupitre_roles',
      ])
        await database.from(name).delete()
      await User.updateOrCreate({ id: 1 }, { name: 'Shield user', email: 'shield@example.com' })
      router.get('/cache', async (ctx) => {
        const user = await User.findOrFail(1)
        return Promise.all([
          shieldAllows(ctx, user, 'posts.viewAny'),
          shieldAllows(ctx, user, 'posts.update'),
          shieldAllows(ctx, user, 'posts.create'),
        ])
      })
      router.get('/cache-revoke', async (ctx) => {
        const user = await User.findOrFail(1)
        const before = await shieldAllows(ctx, user, 'posts.update')
        await database.from('pupitre_permission_role').delete()
        invalidateShieldPermissions()
        const after = await shieldAllows(ctx, user, 'posts.update')
        return { before, after }
      })
      router.get('/cache-transaction', async (ctx) => {
        const user = await User.findOrFail(1)
        const before = await shieldAllows(ctx, user, 'posts.update')
        const trx = await database.transaction()
        let initial: boolean
        let revoked: boolean
        try {
          initial = await shieldAllows(ctx, user, 'posts.update', options, trx)
          await trx.from('pupitre_permission_role').delete()
          revoked = await shieldAllows(ctx, user, 'posts.update', options, trx)
        } finally {
          await trx.rollback()
        }
        const after = await shieldAllows(ctx, user, 'posts.update')
        const next = await database.transaction()
        try {
          return {
            before,
            initial,
            revoked,
            after,
            next: await shieldAllows(ctx, user, 'posts.update', options, next),
          }
        } finally {
          await next.rollback()
        }
      })
    },
  })
}
function request(base: string, path: string, method = 'GET', data?: unknown, cookie?: string) {
  const actionRequest = path.includes('/actions/')
  return fetch(base + path, {
    method,
    redirect: 'manual',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(method !== 'GET' ? { 'X-Pupitre-Action': '1' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(data ? { body: JSON.stringify(actionRequest ? { data } : data) } : {}),
  })
}
async function responseStatus(response: Promise<Response>) {
  const resolved = await response
  return resolved.status
}

test.group('Shield permissions', () => {
  test('editors without roles.viewAny can create and edit users with the roles field hidden', async ({
    assert,
  }) => {
    const app = await fixture(true)
    try {
      const actor = await User.findOrFail(1)
      const cookie = await app.loginAs(actor)
      for (const path of ['/admin/users/create', '/admin/users/' + actor.id + '/edit']) {
        const response = await fetch(app.baseUrl + path, {
          headers: {
            'Accept': 'text/html',
            'X-Inertia': 'true',
            'X-Inertia-Version': '1',
            'Cookie': cookie,
          },
        })
        assert.equal(response.status, 200, await response.clone().text())
        const body = (await response.json()) as { props: unknown }
        const page = pageProps.parse(body.props).page
        const roles = Object.values(page.spec.elements).find(
          (element) => element.props?.name === 'roles'
        )
        assert.isDefined(roles)
        assert.isFalse(roles!.visible)
        assert.deepEqual(roles!.props?.options, [])
      }
      const database = await app.app.container.make('lucid.db')
      const assigned = await Role.create({ name: 'hidden-assignment' })
      await database.table('pupitre_role_user').insert({ user_id: actor.id, role_id: assigned.id })
      const response = await request(
        app.baseUrl,
        '/admin/users/' + actor.id,
        'PUT',
        {
          name: actor.name,
          email: actor.email,
          roles: [],
        },
        cookie
      )
      assert.equal(response.status, 200, await response.text())
      const target = await ShieldUser.findOrFail(actor.id)
      await target.load('roles')
      assert.sameMembers(
        target.roles.map((role) => role.id),
        [assigned.id]
      )
    } finally {
      await closeTestApp(app)
    }
  })

  test('relation manager custom permissions target the related resource and permit super admins', async ({
    assert,
  }) => {
    const app = await fixture(false, true)
    try {
      const manager = await app.app.container.make('pupitre.manager')
      const synced = await syncPermissions(manager.panels)
      assert.include(synced, 'links.review')
      assert.notInclude(synced, 'posts.review')
      const database = await app.app.container.make('lucid.db')
      const admin = await Role.create({ name: 'super-admin' })
      await database.table('pupitre_role_user').insert({ user_id: 1, role_id: admin.id })
      const post = await Post.create({
        title: 'Review parent',
        slug: 'review-parent',
        status: 'draft',
      })
      const link = await PostLink.create({
        postId: post.id,
        label: 'Review link',
        url: 'https://example.test',
      })
      const cookie = await app.loginAs(await User.findOrFail(1))
      const response = await request(
        app.baseUrl,
        `/admin/posts/${post.id}/relations/links/${link.id}/actions/review`,
        'POST',
        { id: link.id },
        cookie
      )
      assert.equal(response.status, 200, await response.text())
    } finally {
      await closeTestApp(app)
    }
  })

  test('roles form only inventories enforced resources and reused plugins isolate panels', async ({
    assert,
  }) => {
    const plugin = shield({ ...options, except: ['users'] })
    const app = await createTestApp({
      panels: {
        first: async () => ({
          default: definePanel('first')
            .path('/first')
            .resources([posts.relations(reviewRelations), explicit, users])
            .plugins([plugin]),
        }),
        second: async () => ({
          default: definePanel('second').path('/second').resources([users]).plugins([plugin]),
        }),
      },
    })
    try {
      const manager = await app.app.container.make('pupitre.manager')
      const [first, second] = manager.panels
      const firstForm = JSON.stringify(
        first!.resources.find((resource) => resource.slug === 'roles')!.definition.form
      )
      const secondForm = JSON.stringify(
        second!.resources.find((resource) => resource.slug === 'roles')!.definition.form
      )
      assert.include(firstForm, 'permissions_posts')
      assert.include(firstForm, 'links.review')
      assert.notInclude(firstForm, 'permissions_users')
      assert.notInclude(firstForm, 'permissions_explicit')
      assert.include(secondForm, 'permissions_roles')
      assert.notInclude(secondForm, 'permissions_posts')
      assert.notInclude(secondForm, 'permissions_links')
    } finally {
      await closeTestApp(app)
    }
  })

  test('checks every CRUD and custom ability, preserves explicit policy, and bypasses for super admins', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      const database = await app.app.container.make('lucid.db')
      const post = await Post.create({ title: 'Shield', slug: 'shield', status: 'draft' })
      const routes: [string, string, string, unknown?][] = [
        ['viewAny', '/admin/posts', 'GET'],
        ['create', '/admin/posts/create', 'GET'],
        ['update', '/admin/posts/' + post.id + '/edit', 'GET'],
        ['delete', '/admin/posts/' + post.id, 'DELETE'],
        ['publish', '/admin/posts/' + post.id + '/actions/publish', 'POST', {}],
      ]
      for (const [, path, method, data] of routes) {
        const response = await request(app.baseUrl, path, method, data)
        assert.equal(response.status, 403, path + ': ' + (await response.text()))
      }
      assert.equal(await responseStatus(request(app.baseUrl, '/admin/explicit')), 200)
      const role = await Role.create({ name: 'editor' })
      await database.table('pupitre_role_user').insert({ user_id: 1, role_id: role.id })
      const viewPermission = await Permission.create({ name: 'posts.view' })
      await role.related('permissions').attach([viewPermission.id])
      for (const [ability, path, method, data] of routes.filter(
        ([candidate]) => candidate !== 'delete'
      )) {
        if (ability === 'publish') {
          const denied = await request(app.baseUrl, path, method, data)
          assert.equal(denied.status, 403)
        }
        const permission = await Permission.create({ name: 'posts.' + ability })
        await role.related('permissions').attach([permission.id])
        assert.equal(await responseStatus(request(app.baseUrl, path, method, data)), 200, ability)
      }
      assert.equal(
        await responseStatus(
          request(app.baseUrl, '/admin/posts', 'POST', {
            title: 'Created',
            slug: 'shield-created',
            status: 'draft',
          })
        ),
        200
      )
      assert.equal(
        await responseStatus(
          request(app.baseUrl, '/admin/posts/' + post.id, 'PUT', {
            title: 'Updated',
            slug: 'shield-updated',
            status: 'draft',
          })
        ),
        200
      )
      const deletePermission = await Permission.create({ name: 'posts.delete' })
      await role.related('permissions').attach([deletePermission.id])
      assert.equal(
        await responseStatus(request(app.baseUrl, '/admin/posts/' + post.id, 'DELETE')),
        200
      )
      await role.merge({ name: 'super-admin' }).save()
      assert.equal(await responseStatus(request(app.baseUrl, '/admin/roles')), 200)
      const manager = await app.app.container.make('pupitre.manager')
      assert.strictEqual(
        manager.panels[0].resources.find((resource) => resource.slug === 'explicit')!.definition
          .policy,
        ExplicitPolicy
      )
    } finally {
      await closeTestApp(app)
    }
  })

  test('caches permission lookups once per request and user; sync is idempotent', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      const database = await app.app.container.make('lucid.db')
      let queries = 0
      const client = database.connection().getWriteClient()
      const listener = (query: { sql: string }) => {
        if (query.sql.includes('pupitre_role_user')) queries++
      }
      client.on('query', listener)
      try {
        await request(app.baseUrl, '/cache')
        assert.equal(queries, 1)
        await request(app.baseUrl, '/cache')
        assert.equal(queries, 2)
      } finally {
        client.off('query', listener)
      }
      const manager = await app.app.container.make('pupitre.manager')
      const first = await syncPermissions(manager.panels, options, 'shield@example.com')
      await syncPermissions(manager.panels, options, '1')
      assert.lengthOf(await Permission.all(), first.length)
      assert.lengthOf(await Role.all(), 1)
      assert.include(first, 'posts.publish')
      assert.include(first, 'links.approve')
      assert.lengthOf(await database.from('pupitre_role_user').where('user_id', 1), 1)
      assert.isFunction(
        manager.panels[0].resources.find((resource) => resource.slug === 'links')!.definition.policy
      )
      const policy = manager.panels[0].resources.find((resource) => resource.slug === 'posts')!
        .definition.policy
      if (typeof policy !== 'function' || !('prototype' in policy))
        throw new Error('Expected a Shield policy class')
      for (const ability of [
        'replicate',
        'reorder',
        'attach',
        'detach',
        'associate',
        'dissociate',
        'restore',
        'forceDelete',
      ])
        assert.equal(typeof Reflect.get(policy.prototype, ability), 'function')
    } finally {
      await closeTestApp(app)
    }
  })

  test('custom pages use the authenticated Lucid user and explicit permission grants', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      const database = await app.app.container.make('lucid.db')
      const cookie = await app.loginAs(await User.findOrFail(1))
      const getPage = () =>
        fetch(app.baseUrl + '/admin/settings', {
          headers: { Accept: 'application/json', Cookie: cookie },
        })
      assert.equal(await responseStatus(getPage()), 403)
      const role = await Role.create({ name: 'settings-editor' })
      const permission = await Permission.create({ name: 'settings.access' })
      await role.related('permissions').attach([permission.id])
      await database.table('pupitre_role_user').insert({ user_id: 1, role_id: role.id })
      assert.equal(await responseStatus(getPage()), 200)
    } finally {
      await closeTestApp(app)
    }
  })

  test('roles resource creates, fills, updates and deletes permission pivots transactionally', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      const database = await app.app.container.make('lucid.db')
      const admin = await Role.create({ name: 'super-admin' })
      await database.table('pupitre_role_user').insert({ user_id: 1, role_id: admin.id })
      const cookie = await app.loginAs(await User.findOrFail(1))
      const created = await request(
        app.baseUrl,
        '/admin/roles',
        'POST',
        {
          name: 'authors',
          permissions_posts: ['posts.viewAny', 'posts.publish'],
        },
        cookie
      )
      assert.equal(created.status, 200, await created.text())
      const role = await Role.findByOrFail('name', 'authors')
      await role.load('permissions')
      assert.sameMembers(
        role.permissions.map((permission) => permission.name),
        ['posts.viewAny', 'posts.publish']
      )
      const edit = await request(
        app.baseUrl,
        '/admin/roles/' + role.id + '/edit',
        'GET',
        undefined,
        cookie
      )
      assert.equal(edit.status, 200)
      const saved = await request(
        app.baseUrl,
        '/admin/roles/' + role.id,
        'PUT',
        {
          name: 'writers',
          permissions_posts: ['posts.update'],
        },
        cookie
      )
      assert.equal(saved.status, 200, await saved.text())
      await role.refresh()
      await role.load('permissions')
      assert.equal(role.name, 'writers')
      assert.sameMembers(
        role.permissions.map((permission) => permission.name),
        ['posts.update']
      )
      assert.equal(
        await responseStatus(
          request(app.baseUrl, '/admin/roles/' + role.id, 'DELETE', undefined, cookie)
        ),
        200
      )
      assert.isNull(await Role.find(role.id))
      assert.lengthOf(await database.from('pupitre_permission_role').where('role_id', role.id), 0)
    } finally {
      await closeTestApp(app)
    }
  })

  test('role editors cannot promote roles or grant permissions they lack', async ({ assert }) => {
    const app = await fixture()
    try {
      const database = await app.app.container.make('lucid.db')
      const editor = await Role.create({ name: 'role-editor' })
      const target = await Role.create({ name: 'limited' })
      const admin = await Role.create({ name: 'super-admin' })
      const permissions = await Permission.createMany(
        [
          'roles.viewAny',
          'roles.view',
          'roles.create',
          'roles.update',
          'roles.delete',
          'posts.viewAny',
        ].map((name) => ({ name }))
      )
      await editor.related('permissions').attach(permissions.map((permission) => permission.id))
      await database.table('pupitre_role_user').insert({ user_id: 1, role_id: editor.id })
      const cookie = await app.loginAs(await User.findOrFail(1))
      assert.equal(
        await responseStatus(
          request(
            app.baseUrl,
            '/admin/roles/' + admin.id,
            'PUT',
            {
              name: 'demoted',
              permissions_posts: [],
            },
            cookie
          )
        ),
        403
      )
      assert.equal(
        await responseStatus(
          request(app.baseUrl, '/admin/roles/' + admin.id, 'DELETE', undefined, cookie)
        ),
        403
      )
      await admin.delete()
      for (const data of [
        { name: 'super-admin', permissions_posts: [] },
        { name: 'escalated', permissions_posts: ['posts.delete'] },
      ]) {
        assert.equal(
          await responseStatus(request(app.baseUrl, '/admin/roles', 'POST', data, cookie)),
          403
        )
        assert.equal(
          await responseStatus(
            request(app.baseUrl, '/admin/roles/' + target.id, 'PUT', data, cookie)
          ),
          403
        )
      }
      assert.equal(
        await responseStatus(
          request(
            app.baseUrl,
            '/admin/roles/' + target.id,
            'PUT',
            {
              name: 'delegated',
              permissions_posts: ['posts.viewAny'],
            },
            cookie
          )
        ),
        200
      )
      await target.refresh()
      await target.load('permissions')
      assert.equal(target.name, 'delegated')
      assert.sameMembers(
        target.permissions.map((permission) => permission.name),
        ['posts.viewAny']
      )
    } finally {
      await closeTestApp(app)
    }
  })

  test('role assignment forms persist and revoke grants without allowing escalation', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      const database = await app.app.container.make('lucid.db')
      const actor = await User.findOrFail(1)
      const cookie = await app.loginAs(actor)
      const editor = await Role.create({ name: 'assignment-editor' })
      const limited = await Role.create({ name: 'limited-assignment' })
      const powerful = await Role.create({ name: 'powerful-assignment' })
      const admin = await Role.create({ name: 'super-admin' })
      const permissions = await Permission.createMany(
        [
          'users.viewAny',
          'users.view',
          'users.create',
          'users.update',
          'roles.viewAny',
          'roles.view',
          'roles.update',
          'posts.viewAny',
          'posts.delete',
        ].map((name) => ({ name }))
      )
      const byName = new Map(permissions.map((permission) => [permission.name, permission.id]))
      await editor
        .related('permissions')
        .attach(
          permissions
            .filter((permission) => permission.name !== 'posts.delete')
            .map((permission) => permission.id)
        )
      await limited.related('permissions').attach([byName.get('posts.viewAny')!])
      await powerful.related('permissions').attach([byName.get('posts.delete')!])
      await database.table('pupitre_role_user').insert({ user_id: actor.id, role_id: editor.id })
      const created = await request(
        app.baseUrl,
        '/admin/users',
        'POST',
        {
          name: 'Assigned user',
          email: 'assigned@example.com',
          roles: [String(limited.id)],
        },
        cookie
      )
      assert.equal(created.status, 200, await created.text())
      const target = await ShieldUser.findByOrFail('email', 'assigned@example.com')
      await target.load('roles')
      assert.sameMembers(
        target.roles.map((role) => role.id),
        [limited.id]
      )
      const targetCookie = await app.loginAs(target)
      assert.equal(
        await responseStatus(request(app.baseUrl, '/admin/posts', 'GET', undefined, targetCookie)),
        200
      )
      const edit = await fetch(app.baseUrl + '/admin/users/' + target.id + '/edit', {
        headers: {
          'Accept': 'text/html',
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
          'Cookie': cookie,
        },
      })
      assert.equal(edit.status, 200, await edit.clone().text())
      const body = (await edit.json()) as { props: unknown }
      const page = pageProps.parse(body.props).page
      assert.deepEqual((page.state.data as Record<string, unknown>).roles, [limited.id])
      for (const role of [admin, powerful]) {
        const denied = await request(
          app.baseUrl,
          '/admin/users/' + target.id,
          'PUT',
          {
            name: 'Escalated user',
            email: target.email,
            roles: [String(role.id)],
          },
          cookie
        )
        assert.equal(denied.status, 403, await denied.text())
        await target.refresh()
        await target.load('roles')
        assert.equal(target.name, 'Assigned user')
        assert.sameMembers(
          target.roles.map((assigned) => assigned.id),
          [limited.id]
        )
        const deniedCreate = await request(
          app.baseUrl,
          '/admin/users',
          'POST',
          {
            name: 'Escalation',
            email: 'escalation@example.com',
            roles: [String(role.id)],
          },
          cookie
        )
        assert.equal(deniedCreate.status, 403, await deniedCreate.text())
        assert.isNull(await ShieldUser.findBy('email', 'escalation@example.com'))
      }
      for (const role of [admin, powerful]) {
        await target.related('roles').attach([role.id])
        const deniedRevoke = await request(
          app.baseUrl,
          '/admin/users/' + target.id,
          'PUT',
          {
            name: target.name,
            email: target.email,
            roles: [String(limited.id)],
          },
          cookie
        )
        assert.equal(deniedRevoke.status, 403, await deniedRevoke.text())
        await target.load('roles')
        assert.sameMembers(
          target.roles.map((assigned) => assigned.id),
          [limited.id, role.id]
        )
        await target.related('roles').detach([role.id])
      }
      const revoked = await request(
        app.baseUrl,
        '/admin/users/' + target.id,
        'PUT',
        {
          name: target.name,
          email: target.email,
          roles: [],
        },
        cookie
      )
      assert.equal(revoked.status, 200, await revoked.text())
      await target.load('roles')
      assert.lengthOf(target.roles, 0)
      assert.equal(
        await responseStatus(request(app.baseUrl, '/admin/posts', 'GET', undefined, targetCookie)),
        403
      )
      // Resource update alone must not confer role-assignment authority.
      await editor.related('permissions').detach([byName.get('roles.update')!])
      invalidateShieldPermissions()
      const denied = await request(
        app.baseUrl,
        '/admin/users/' + target.id,
        'PUT',
        {
          name: target.name,
          email: target.email,
          roles: [String(limited.id)],
        },
        cookie
      )
      assert.equal(denied.status, 403, await denied.text())
      await target.load('roles')
      assert.lengthOf(target.roles, 0)
    } finally {
      await closeTestApp(app)
    }
  })

  test('explicit user policies clear roles with request grants inside the save transaction', async ({
    assert,
  }) => {
    const app = await fixture(true)
    try {
      const database = await app.app.container.make('lucid.db')
      const actor = await User.findOrFail(1)
      const editor = await Role.create({ name: 'cold-cache-editor' })
      const limited = await Role.create({ name: 'cold-cache-limited' })
      const permissions = await Permission.createMany(
        ['roles.viewAny', 'roles.update', 'posts.viewAny'].map((name) => ({ name }))
      )
      await editor.related('permissions').attach(permissions.map((permission) => permission.id))
      await limited
        .related('permissions')
        .attach(
          permissions
            .filter((permission) => permission.name === 'posts.viewAny')
            .map((permission) => permission.id)
        )
      await database.table('pupitre_role_user').insert({ user_id: actor.id, role_id: editor.id })
      const target = await ShieldUser.create({
        name: 'Cold cache target',
        email: 'cold-cache@example.com',
      })
      await target.related('roles').attach([limited.id])
      const cookie = await app.loginAs(actor)
      invalidateShieldPermissions()
      // Middleware warms request grants; the save transaction reads its own snapshot.
      const response = await request(
        app.baseUrl,
        '/admin/users/' + target.id,
        'PUT',
        { name: target.name, email: target.email, roles: [] },
        cookie
      )
      assert.equal(response.status, 200, await response.text())
      await target.load('roles')
      assert.lengthOf(target.roles, 0)
    } finally {
      await closeTestApp(app)
    }
  })

  test('role editors preserve unchanged powerful grants but cannot revoke grants they lack', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      const database = await app.app.container.make('lucid.db')
      const editor = await Role.create({ name: 'grant-change-editor' })
      const target = await Role.create({ name: 'powerful-target' })
      const permissions = await Permission.createMany(
        [
          'roles.viewAny',
          'roles.view',
          'roles.update',
          'posts.viewAny',
          'posts.delete',
          'settings.access',
        ].map((name) => ({ name }))
      )
      const byName = new Map(permissions.map((permission) => [permission.name, permission.id]))
      await editor
        .related('permissions')
        .attach(
          ['roles.viewAny', 'roles.view', 'roles.update', 'posts.viewAny'].map((name) =>
            byName.get(name)!
          )
        )
      await target
        .related('permissions')
        .attach(
          ['posts.viewAny', 'posts.delete', 'settings.access'].map((name) => byName.get(name)!)
        )
      await database.table('pupitre_role_user').insert({ user_id: 1, role_id: editor.id })
      const cookie = await app.loginAs(await User.findOrFail(1))
      const renamed = await request(
        app.baseUrl,
        '/admin/roles/' + target.id,
        'PUT',
        { name: 'renamed-powerful', permissions_posts: ['posts.viewAny', 'posts.delete'] },
        cookie
      )
      assert.equal(renamed.status, 200, await renamed.text())
      await target.refresh()
      await target.load('permissions')
      assert.equal(target.name, 'renamed-powerful')
      assert.sameMembers(
        target.permissions.map((permission) => permission.name),
        ['posts.viewAny', 'posts.delete', 'settings.access']
      )
      // Both a submitted empty list and an omitted resource field remove existing grants.
      for (const data of [
        { name: 'stripped', permissions_posts: ['posts.viewAny'] },
        { name: 'stripped', permissions_posts: [] },
        { name: 'stripped' },
      ]) {
        const denied = await request(app.baseUrl, '/admin/roles/' + target.id, 'PUT', data, cookie)
        assert.equal(denied.status, 403, await denied.text())
        await target.refresh()
        await target.load('permissions')
        assert.equal(target.name, 'renamed-powerful')
        assert.sameMembers(
          target.permissions.map((permission) => permission.name),
          ['posts.viewAny', 'posts.delete', 'settings.access']
        )
      }
      const revoked = await request(
        app.baseUrl,
        '/admin/roles/' + target.id,
        'PUT',
        { name: target.name, permissions_posts: ['posts.delete'] },
        cookie
      )
      assert.equal(revoked.status, 200, await revoked.text())
      await target.load('permissions')
      assert.sameMembers(
        target.permissions.map((permission) => permission.name),
        ['posts.delete', 'settings.access']
      )
    } finally {
      await closeTestApp(app)
    }
  })

  test('role deletion cannot revoke resource or host permissions the actor lacks', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      const database = await app.app.container.make('lucid.db')
      const actor = await User.findOrFail(1)
      const recipient = await ShieldUser.create({
        name: 'Deletion recipient',
        email: 'deletion-recipient@example.com',
      })
      const editor = await Role.create({ name: 'deletion-editor' })
      const limited = await Role.create({ name: 'deletion-limited' })
      const powerful = await Role.create({ name: 'deletion-powerful' })
      const host = await Role.create({ name: 'deletion-host' })
      const permissions = await Permission.createMany(
        ['roles.viewAny', 'roles.delete', 'posts.viewAny', 'posts.delete', 'settings.access'].map(
          (name) => ({
            name,
          })
        )
      )
      const byName = new Map(permissions.map((permission) => [permission.name, permission.id]))
      await editor
        .related('permissions')
        .attach([
          byName.get('roles.viewAny')!,
          byName.get('roles.delete')!,
          byName.get('posts.viewAny')!,
        ])
      await limited.related('permissions').attach([byName.get('posts.viewAny')!])
      await powerful.related('permissions').attach([byName.get('posts.delete')!])
      await host.related('permissions').attach([byName.get('settings.access')!])
      await database.table('pupitre_role_user').insert({ user_id: actor.id, role_id: editor.id })
      await recipient.related('roles').attach([powerful.id, host.id])
      const cookie = await app.loginAs(actor)
      for (const role of [powerful, host]) {
        const denied = await request(
          app.baseUrl,
          '/admin/roles/' + role.id,
          'DELETE',
          undefined,
          cookie
        )
        assert.equal(denied.status, 403, await denied.text())
        assert.isNotNull(await Role.find(role.id))
        await role.load('permissions')
        assert.lengthOf(role.permissions, 1)
      }
      await recipient.load('roles')
      assert.sameMembers(
        recipient.roles.map((role) => role.id),
        [powerful.id, host.id]
      )
      const allowed = await request(
        app.baseUrl,
        '/admin/roles/' + limited.id,
        'DELETE',
        undefined,
        cookie
      )
      assert.equal(allowed.status, 200, await allowed.text())
      assert.isNull(await Role.find(limited.id))
      const admin = await Role.create({ name: 'super-admin' })
      await database.table('pupitre_role_user').insert({ user_id: actor.id, role_id: admin.id })
      invalidateShieldPermissions()
      for (const role of [powerful, host]) {
        const deleted = await request(
          app.baseUrl,
          '/admin/roles/' + role.id,
          'DELETE',
          undefined,
          cookie
        )
        assert.equal(deleted.status, 200, await deleted.text())
        assert.isNull(await Role.find(role.id))
      }
      await recipient.load('roles')
      assert.lengthOf(recipient.roles, 0)
    } finally {
      await closeTestApp(app)
    }
  })

  test('invalid integer role assignments return 422 before querying roles on create or update', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      const database = await app.app.container.make('lucid.db')
      const admin = await Role.create({ name: 'super-admin' })
      await database.table('pupitre_role_user').insert({ user_id: 1, role_id: admin.id })
      const cookie = await app.loginAs(await User.findOrFail(1))
      const target = await ShieldUser.create({
        name: 'Integer recipient',
        email: 'integer-recipient@example.com',
      })
      const assigned = await Role.create({ name: 'integer-assigned' })
      await target.related('roles').attach([assigned.id])
      const client = database.connection().getWriteClient()
      let roleQueries = 0
      const listener = (query: { sql: string }) => {
        // Rendering options can query all roles; only the assignment lookup casts
        // submitted values through the integer id column.
        if (
          /from ["`]pupitre_roles["`]/i.test(query.sql) &&
          /where ["`]id["`] in \(/i.test(query.sql)
        )
          roleQueries++
      }
      client.on('query', listener)
      try {
        for (const id of [
          'x',
          '',
          ' ',
          '1.5',
          '1e2',
          '0x10',
          '-1',
          '0',
          '2147483648',
          '9007199254740993',
          1.5,
          0,
          -1,
          2147483648,
        ]) {
          for (const method of ['POST', 'PUT']) {
            roleQueries = 0
            const response = await request(
              app.baseUrl,
              method === 'POST' ? '/admin/users' : '/admin/users/' + target.id,
              method,
              {
                name: 'Invalid integer assignment',
                email: method === 'POST' ? 'invalid-integer@example.com' : target.email,
                roles: [id],
              },
              cookie
            )
            assert.equal(response.status, 422, await response.text())
            assert.equal(roleQueries, 0, `Role query executed for ${method} id ${String(id)}`)
          }
        }
      } finally {
        client.off('query', listener)
      }
      assert.isNull(await ShieldUser.findBy('email', 'invalid-integer@example.com'))
      await target.refresh()
      assert.equal(target.name, 'Integer recipient')
      await target.load('roles')
      assert.sameMembers(
        target.roles.map((role) => role.id),
        [assigned.id]
      )
      roleQueries = 0
      client.on('query', listener)
      const valid = await request(
        app.baseUrl,
        '/admin/users/' + target.id,
        'PUT',
        {
          name: target.name,
          email: target.email,
          roles: [assigned.id, String(assigned.id), '0' + assigned.id],
        },
        cookie
      )
      client.off('query', listener)
      assert.equal(roleQueries, 1, 'The spy must observe a valid assignment lookup')
      assert.equal(valid.status, 200, await valid.text())
      await target.load('roles')
      assert.sameMembers(
        target.roles.map((role) => role.id),
        [assigned.id]
      )
    } finally {
      await closeTestApp(app)
    }
  })

  test('transaction permission reads ignore request caches and rolled-back snapshots', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      const database = await app.app.container.make('lucid.db')
      const role = await Role.create({ name: 'snapshot-editor' })
      const permission = await Permission.create({ name: 'posts.update' })
      await role.related('permissions').attach([permission.id])
      await database.table('pupitre_role_user').insert({ user_id: 1, role_id: role.id })
      const response = await request(app.baseUrl, '/cache-transaction')
      assert.equal(response.status, 200, await response.clone().text())
      assert.deepEqual(await response.json(), {
        before: true,
        initial: true,
        revoked: false,
        after: true,
        next: true,
      })
    } finally {
      await closeTestApp(app)
    }
  })

  test('permission revocation invalidates grants in the same request', async ({ assert }) => {
    const app = await fixture()
    try {
      const database = await app.app.container.make('lucid.db')
      const role = await Role.create({ name: 'editor' })
      const permission = await Permission.create({ name: 'posts.update' })
      await role.related('permissions').attach([permission.id])
      await database.table('pupitre_role_user').insert({ user_id: 1, role_id: role.id })
      const response = await request(app.baseUrl, '/cache-revoke')
      assert.deepEqual(await response.json(), { before: true, after: false })
    } finally {
      await closeTestApp(app)
    }
  })
})
