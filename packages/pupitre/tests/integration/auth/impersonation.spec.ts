import { z } from 'zod'
import type { ImpersonationEvent } from '../../../src/auth/impersonation.js'
import { test } from '@japa/runner'
import { actions, definePanel, defineResource, pages, table } from '../../../index.js'
import { closeTestApp, createTestApp, User } from '../../helpers/app.js'
import PupitreManager from '../../../src/manager.js'

const identity = z.union([z.string(), z.number()])
const sessionSnapshot = z.object({
  id: z.string(),
  impersonation: z.object({ actorId: identity, targetId: identity }).optional(),
})
const profileSnapshot = z.object({
  props: z.object({
    pupitre: z.object({
      user: z.object({ id: identity }),
      impersonation: z.object({ name: z.string() }).optional(),
    }),
  }),
})

class Policy {
  viewAny() {
    return true
  }
  view() {
    return true
  }
  impersonate(actor: User, target: User) {
    return actor.email.startsWith('admin') && target.email !== 'denied@test.local'
  }
}
class MissingPolicy {
  viewAny() {
    return true
  }
  view() {
    return true
  }
}
function cookies(response: Response, previous = '') {
  const values = new Map(
    previous
      .split('; ')
      .filter(Boolean)
      .map((pair) => [pair.split('=')[0]!, pair])
  )
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0]!
    values.set(pair.split('=')[0]!, pair)
  }
  return [...values.values()].join('; ')
}
function panel(policy: typeof MissingPolicy = Policy) {
  return definePanel('admin')
    .path('/admin')
    .login()
    .profile()
    .impersonation()
    .resources([
      defineResource(User)
        .slug('users')
        .policy(policy)
        .actions({ row: [actions.impersonate()] })
        .pages({ list: pages.list(), view: pages.view() }),
    ])
}
async function login(baseUrl: string, email: string) {
  return fetch(`${baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'text/html' },
    body: JSON.stringify({ email, password: 'password' }),
    redirect: 'manual',
  })
}
async function request(baseUrl: string, path: string, cookie: string) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Accept': 'application/json',
      'X-Pupitre-Action': '1',
      'X-Pupitre-Url': '/admin/users',
      'Content-Type': 'application/json',
    },
    body: '{}',
    redirect: 'manual',
  })
}

test.group('Impersonation authorization and session lifecycle', () => {
  test('sessions and impersonation require built-in login at boot', async ({ assert }) => {
    const fixture = await createTestApp()
    try {
      for (const invalid of [
        definePanel('sessions').login(false).sessions(),
        definePanel('impersonation').login(false).impersonation(),
        definePanel('disabled-after').login().sessions().login(false),
      ]) {
        const manager = new PupitreManager(fixture.app)
        await assert.rejects(() => manager.boot([invalid]), /requires built-in .login\(\)/)
      }
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('starts and leaves, rejects self, nested, policy denial, and blocks profile changes', async ({
    assert,
  }) => {
    const events: ImpersonationEvent[] = []
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel().locales(['en', 'id']) }) },
      pupitre: {
        auth: {
          model: async () => ({ default: User }),
          columns: { name: 'name', locale: 'fullName' },
        },
      },
      setup: async (router, app) => {
        const emitter = await app.container.make('emitter')
        emitter.on('pupitre:impersonation:started', (event) => {
          events.push(event)
        })
        emitter.on('pupitre:impersonation:stopped', (event) => {
          events.push(event)
        })
        router.get('/inspect-session', (ctx) => ({
          id: ctx.session.sessionId,
          impersonation: ctx.session.get('pupitre.impersonation'),
        }))
      },
    })
    try {
      const actor = await User.create({
        name: 'Admin',
        email: 'admin@test.local',
        password: 'password',
      })
      const target = await User.create({
        name: 'Target',
        email: 'target@test.local',
        fullName: 'en',
        password: 'password',
      })
      const denied = await User.create({
        name: 'Denied',
        email: 'denied@test.local',
        password: 'password',
      })
      let cookie = cookies(await login(fixture.baseUrl, actor.email))
      const beforeResponse = await fetch(`${fixture.baseUrl}/inspect-session`, {
        headers: { Cookie: cookie },
      })
      const beforeSession = sessionSnapshot.parse(await beforeResponse.json())
      for (const id of [actor.id, denied.id]) {
        const deniedResponse = await request(
          fixture.baseUrl,
          `/admin/users/${id}/actions/impersonate`,
          cookie
        )
        assert.equal(deniedResponse.status, 403)
      }
      const started = await request(
        fixture.baseUrl,
        `/admin/users/${target.id}/actions/impersonate`,
        cookie
      )
      assert.equal(started.status, 200, await started.clone().text())
      assert.notEqual(cookies(started), '')
      cookie = cookies(started, cookie)
      const activeResponse = await fetch(`${fixture.baseUrl}/inspect-session`, {
        headers: { Cookie: cookie },
      })
      const activeSession = sessionSnapshot.parse(await activeResponse.json())
      assert.notEqual(activeSession.id, beforeSession.id)
      assert.equal(activeSession.impersonation?.actorId, actor.id)
      assert.equal(activeSession.impersonation?.targetId, target.id)
      const page = await fetch(`${fixture.baseUrl}/admin/profile`, {
        headers: { 'Cookie': cookie, 'X-Inertia': 'true', 'Accept': 'text/html' },
      })
      const props = profileSnapshot.parse(await page.json())
      assert.equal(props.props.pupitre.user.id, target.id)
      assert.equal(props.props.pupitre.impersonation?.name, 'Target')
      const nested = await request(
        fixture.baseUrl,
        `/admin/users/${actor.id}/actions/impersonate`,
        cookie
      )
      assert.equal(nested.status, 403)
      const blocked = await fetch(`${fixture.baseUrl}/admin/profile`, {
        method: 'PUT',
        headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'new-password' }),
        redirect: 'manual',
      })
      assert.equal(blocked.status, 403)
      const localeChange = await fetch(`${fixture.baseUrl}/admin/locale`, {
        method: 'POST',
        headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: 'id' }),
        redirect: 'manual',
      })
      assert.equal(localeChange.status, 403)
      const unchangedTarget = await User.findOrFail(target.id)
      assert.equal(unchangedTarget.fullName, 'en')
      const leave = await request(fixture.baseUrl, '/admin/impersonation/leave', cookie)
      assert.equal(leave.status, 302)
      assert.equal(leave.headers.get('location'), '/admin/users')
      cookie = cookies(leave, cookie)
      const restoredResponse = await fetch(`${fixture.baseUrl}/inspect-session`, {
        headers: { Cookie: cookie },
      })
      const restoredSession = sessionSnapshot.parse(await restoredResponse.json())
      assert.notEqual(restoredSession.id, activeSession.id)
      assert.isUndefined(restoredSession.impersonation)
      assert.deepEqual(events, [
        { actorId: actor.id, targetId: target.id, panelId: 'admin' },
        { actorId: actor.id, targetId: target.id, panelId: 'admin' },
      ])
      const restored = await fetch(`${fixture.baseUrl}/admin/profile`, {
        headers: { 'Cookie': cookie, 'X-Inertia': 'true', 'Accept': 'text/html' },
      })
      const restoredProps = profileSnapshot.parse(await restored.json())
      assert.equal(restoredProps.props.pupitre.user.id, actor.id)
      assert.isUndefined(restoredProps.props.pupitre.impersonation)
      const next = await request(
        fixture.baseUrl,
        `/admin/users/${target.id}/actions/impersonate`,
        cookie
      )
      cookie = cookies(next, cookie)
      await actor.delete()
      const deletedLeave = await request(fixture.baseUrl, '/admin/impersonation/leave', cookie)
      assert.equal(deletedLeave.headers.get('location'), '/admin/login')
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('missing impersonate ability denies even when resource is readable', async ({ assert }) => {
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel(MissingPolicy) }) },
      pupitre: { auth: { model: async () => ({ default: User }) } },
    })
    try {
      const actor = await User.create({
        name: 'Admin',
        email: 'missing-admin@test.local',
        password: 'password',
      })
      const target = await User.create({
        name: 'Target',
        email: 'missing-target@test.local',
        password: 'password',
      })
      const cookie = cookies(await login(fixture.baseUrl, actor.email))
      const deniedResponse = await request(
        fixture.baseUrl,
        `/admin/users/${target.id}/actions/impersonate`,
        cookie
      )
      assert.equal(deniedResponse.status, 403)
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('scoped lookup hides users in another tenant', async ({ assert }) => {
    const tenantPanel = panel().tenancy({
      mode: 'url',
      adapter: {
        async resolve() {
          return { id: 1, name: 'A', slug: 'a' }
        },
        scope(query) {
          query.where('email', 'like', 'admin%')
        },
        fill(data) {
          return data
        },
        async listForUser(ctx) {
          const user = ctx.pupitre.authUser as User | null
          return user?.email.startsWith('admin') ? [{ id: 1, name: 'A', slug: 'a' }] : []
        },
      },
    })
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: tenantPanel }) },
      pupitre: { auth: { model: async () => ({ default: User }) } },
    })
    try {
      const actor = await User.create({
        name: 'Admin',
        email: 'admin-scoped@test.local',
        password: 'password',
      })
      const other = await User.create({
        name: 'Other',
        email: 'other-tenant@test.local',
        password: 'password',
      })
      const cookie = cookies(await login(fixture.baseUrl, actor.email))
      const deniedResponse = await request(
        fixture.baseUrl,
        `/admin/a/users/${other.id}/actions/impersonate`,
        cookie
      )
      assert.equal(deniedResponse.status, 404)
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('global Users resource still rejects a target outside the current tenant', async ({
    assert,
  }) => {
    const tenantPanel = panel()
      .resources([
        defineResource(User)
          .slug('users')
          .scope(false)
          .policy(Policy)
          .actions({ row: [actions.impersonate()] })
          .pages({ list: pages.list() }),
      ])
      .tenancy({
        mode: 'url',
        adapter: {
          async resolve() {
            return { id: 1, name: 'A', slug: 'a' }
          },
          scope(query) {
            query.where('email', 'like', 'admin%')
          },
          fill(data) {
            return data
          },
          async listForUser(ctx) {
            const user = ctx.pupitre.authUser as User | null
            return user?.email.startsWith('admin') ? [{ id: 1, name: 'A', slug: 'a' }] : []
          },
        },
      })
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: tenantPanel }) },
      pupitre: { auth: { model: async () => ({ default: User }) } },
    })
    try {
      const actor = await User.create({
        name: 'Admin',
        email: 'admin-global@test.local',
        password: 'password',
      })
      const target = await User.create({
        name: 'Global Other',
        email: 'global-other@test.local',
        password: 'password',
      })
      const cookie = cookies(await login(fixture.baseUrl, actor.email))
      const deniedResponse = await request(
        fixture.baseUrl,
        `/admin/a/users/${target.id}/actions/impersonate`,
        cookie
      )
      assert.equal(deniedResponse.status, 403)
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('record header actions work and ordinary users cannot impersonate', async ({ assert }) => {
    const headerPanel = panel().resources([
      defineResource(User)
        .slug('users')
        .policy(Policy)
        .table((t) => t.columns([table.text('email')]))
        .actions({ header: [actions.impersonate()] })
        .pages({ list: pages.list(), view: pages.view() }),
    ])
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: headerPanel }) },
      pupitre: { auth: { model: async () => ({ default: User }) } },
    })
    try {
      const actor = await User.create({
        name: 'Admin',
        email: 'admin-header@test.local',
        password: 'password',
      })
      const target = await User.create({
        name: 'User',
        email: 'user-header@test.local',
        password: 'password',
      })
      const ordinaryCookie = cookies(await login(fixture.baseUrl, target.email))
      const deniedResponse = await request(
        fixture.baseUrl,
        `/admin/users/${actor.id}/actions/impersonate`,
        ordinaryCookie
      )
      assert.equal(deniedResponse.status, 403)
      const cookie = cookies(await login(fixture.baseUrl, actor.email))
      const list = await fetch(`${fixture.baseUrl}/admin/users`, {
        headers: {
          'Cookie': cookie,
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
          'Accept': 'text/html',
        },
      })
      assert.equal(list.status, 200)
      const started = await request(
        fixture.baseUrl,
        `/admin/users/${target.id}/actions/impersonate`,
        cookie
      )
      assert.equal(started.status, 200)
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('enabled actor MFA must be satisfied while target MFA is not challenged', async ({
    assert,
  }) => {
    const mfaPanel = panel().mfa()
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: mfaPanel }) },
      pupitre: { auth: { model: async () => ({ default: User }) } },
    })
    try {
      const db = fixture.database.connection()
      if (!(await db.schema.hasColumn('users', 'mfa_enabled_at')))
        await db.schema.alterTable('users', (schemaTable) => {
          schemaTable.timestamp('mfa_enabled_at').nullable()
        })
      const actor = await User.create({
        name: 'Admin',
        email: 'admin-mfa@test.local',
        password: 'password',
      })
      const target = await User.create({
        name: 'Target',
        email: 'target-mfa@test.local',
        password: 'password',
      })
      const cookie = cookies(await login(fixture.baseUrl, actor.email))
      await db
        .from('users')
        .where('id', target.id)
        .update({ mfa_enabled_at: '2026-10-13 00:00:00' })
      const started = await request(
        fixture.baseUrl,
        `/admin/users/${target.id}/actions/impersonate`,
        cookie
      )
      assert.equal(started.status, 200)
      const leave = await request(
        fixture.baseUrl,
        '/admin/impersonation/leave',
        cookies(started, cookie)
      )
      const restoredCookie = cookies(leave, cookie)
      await db.from('users').where('id', actor.id).update({ mfa_enabled_at: '2026-10-13 00:00:00' })
      const deniedResponse = await request(
        fixture.baseUrl,
        `/admin/users/${target.id}/actions/impersonate`,
        restoredCookie
      )
      assert.equal(deniedResponse.status, 403)
    } finally {
      await closeTestApp(fixture)
    }
  })
})
