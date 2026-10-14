import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { setupDatabase, truncate } from '../../helpers/db.js'
import { test } from '@japa/runner'
import { DateTime, Settings } from 'luxon'
import { generate, generateSecret } from 'otplib'
import { defineConfig as encryptionConfig, drivers } from '@adonisjs/core/encryption'
import { defineConfig as authConfig } from '@adonisjs/auth'
import {
  sessionGuard,
  sessionUserProvider,
  DbRememberMeTokensProvider,
} from '@adonisjs/auth/session'
import { IgnitorFactory } from '@adonisjs/core/factories'
import { ListLoader } from '@adonisjs/ace'
import { definePanel, defineResource, pages, defineConfig } from '../../../index.js'
import { closeTestApp, createTestApp, User, type TestApplication } from '../../helpers/app.js'
import PupitrePruneCommand from '../../../commands/prune.js'
import { loginHistoryWidget } from '../../../src/auth/login_history_widget.js'
import { setWebAuthnLoaderForTests } from '../../../src/auth/passkey_service.js'
import type { HttpContext } from '@adonisjs/core/http'
import * as webauthn from '@simplewebauthn/server'

class HistoryPolicy {
  viewAny() {
    return true
  }
  view() {
    return true
  }
  viewLoginHistory(actor: User) {
    return actor.email === 'sessions@example.test'
  }
}
class RememberUser extends User {
  static table = 'users'
  static rememberMeTokens = DbRememberMeTokensProvider.forModel(RememberUser)
}
function cookies(response: Response, previous = '') {
  const values = new Map(
    previous
      .split('; ')
      .filter(Boolean)
      .map((pair) => [pair.split('=')[0]!, pair])
  )
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';')[0]!
    values.set(pair.split('=')[0]!, pair)
  }
  return [...values.values()].join('; ')
}
const userConfig = {
  model: async () => ({ default: User }),
  columns: { name: 'name', socialProvider: 'provider', socialProviderId: 'providerId' },
}
const panel = definePanel('admin')
  .login()
  .profile()
  .sessions()
  .resources([
    defineResource(User)
      .slug('users')
      .scope(false)
      .policy(HistoryPolicy)
      .pages({ view: pages.view().footerWidgets([loginHistoryWidget()]) }),
  ])
async function tables(app: TestApplication) {
  const schema = app.database.connection().schema
  await schema.dropTableIfExists('pupitre_user_sessions')
  await schema.dropTableIfExists('pupitre_login_events')
  await schema.createTable('pupitre_user_sessions', (table) => {
    table.string('id').primary()
    for (const column of ['user_id', 'guard', 'panel', 'token_hash', 'ip']) table.string(column)
    table.string('remember_token_id').nullable()
    table.string('user_agent', 512)
    for (const column of ['created_at', 'last_active_at', 'expires_at', 'revoked_at'])
      table.timestamp(column)
    table.boolean('remembered').notNullable().defaultTo(false)
  })
  await schema.createTable('pupitre_login_events', (table) => {
    table.increments('id')
    for (const column of ['user_id', 'panel', 'event', 'method', 'ip']) table.string(column)
    table.string('user_agent', 512)
    table.timestamp('created_at')
  })
}
async function cleanup(app: TestApplication) {
  await app.database.connection().schema.dropTableIfExists('pupitre_user_sessions')
  await app.database.connection().schema.dropTableIfExists('pupitre_login_events')
  await app.database.connection().schema.dropTableIfExists('remember_me_tokens')
  await closeTestApp(app)
}
async function fixture(authPanel = panel) {
  const app = await createTestApp({
    panels: { admin: async () => ({ default: authPanel }) },
    pupitre: { auth: userConfig },
  })
  await tables(app)
  return app
}
async function login(app: TestApplication, email = 'sessions@example.test', remember = false) {
  return fetch(`${app.baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password', remember }),
    redirect: 'manual',
  })
}
async function user(email = 'sessions@example.test') {
  return User.create({ name: 'Sessions', fullName: 'Sessions', email, password: 'password' })
}
async function request(
  app: TestApplication,
  path: string,
  cookie: string,
  method = 'GET',
  body?: unknown
) {
  return fetch(`${app.baseUrl}${path}`, {
    method,
    headers: { 'Cookie': cookie, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    redirect: 'manual',
  })
}
async function rememberedFixture() {
  const app = await createTestApp({
    panels: { admin: async () => ({ default: panel }) },
    pupitre: { auth: { ...userConfig, model: async () => ({ default: RememberUser }) } },
    config: {
      encryption: encryptionConfig({
        default: 'gcm',
        list: { gcm: drivers.aes256gcm({ keys: ['01234567890123456789012345678901'], id: 'gcm' }) },
      }),
      auth: authConfig({
        default: 'web',
        guards: {
          web: sessionGuard({
            useRememberMeTokens: true,
            rememberMeTokensAge: '3 days',
            provider: sessionUserProvider({ model: async () => ({ default: RememberUser }) }),
          }),
        },
      }),
    },
  })
  await tables(app)
  await app.database.connection().schema.createTable('remember_me_tokens', (table) => {
    table.increments('id')
    table.integer('tokenable_id').notNullable()
    table.string('hash').notNullable()
    table.timestamp('created_at')
    table.timestamp('updated_at')
    table.timestamp('expires_at')
  })
  return app
}
function rememberOnly(cookie: string) {
  return cookie
    .split('; ')
    .filter((pair) => pair.startsWith('remember_web='))
    .join('; ')
}

test.group('Browser sessions', (group) => {
  group.each.setup(async () => {
    await setupDatabase()
    await truncate()
  })
  for (const action of ['revoke', 'others', 'logout', 'unknown', 'revoked-row']) {
    test(`remember cookie cannot revive a ${action} browser after server-session expiry`, async ({
      assert,
    }) => {
      const app = await rememberedFixture()
      try {
        await user()
        const one = cookies(await login(app))
        const two = cookies(await login(app, 'sessions@example.test', true))
        const row = await app.database
          .from('pupitre_user_sessions')
          .where('remembered', true)
          .first()
        assert.isNotNull(row.remember_token_id)
        assert.lengthOf(await app.database.from('remember_me_tokens'), 1)
        if (action === 'revoke') {
          const revoked = await request(app, `/admin/profile/sessions/${row.id}`, one, 'DELETE')
          assert.equal(revoked.status, 204)
        } else if (action === 'others') {
          const revoked = await request(app, '/admin/profile/sessions/logout-others', one, 'POST', {
            current_password: 'password',
          })
          assert.equal(revoked.status, 204)
        } else if (action === 'logout') {
          const loggedOut = await request(app, '/admin/logout', two, 'POST')
          assert.equal(loggedOut.status, 302)
        } else if (action === 'unknown') {
          await app.database.from('pupitre_user_sessions').where('id', row.id).delete()
        } else {
          await app.database
            .from('pupitre_user_sessions')
            .where('id', row.id)
            .update({ revoked_at: DateTime.utc().toSQL() })
        }
        const before = await app.database.from('pupitre_user_sessions')
        // Only the remember cookie survives; no server authentication or tracking token is presented.
        const returning = await request(app, '/admin/profile', rememberOnly(two))
        assert.equal(returning.status, 401, await returning.clone().text())
        assert.lengthOf(await app.database.from('pupitre_user_sessions'), before.length)
        assert.lengthOf(await app.database.from('remember_me_tokens'), 0)
        if (action !== 'unknown') {
          const revoked = await app.database
            .from('pupitre_user_sessions')
            .where('id', row.id)
            .first()
          assert.isNotNull(revoked.revoked_at)
        }
      } finally {
        await cleanup(app)
      }
    })
  }

  test('stale login POST replaces the remembered row without an orphan or remember login event', async ({
    assert,
  }) => {
    const app = await rememberedFixture()
    try {
      await user()
      const remembered = cookies(await login(app, 'sessions@example.test', true))
      const old = await app.database.from('pupitre_user_sessions').first()
      const completed = await request(app, '/admin/login', rememberOnly(remembered), 'POST', {
        email: 'sessions@example.test',
        password: 'password',
        remember: true,
      })
      assert.equal(completed.status, 302, await completed.clone().text())
      const rows = await app.database.from('pupitre_user_sessions')
      assert.lengthOf(rows, 2)
      assert.lengthOf(
        rows.filter((row) => row.revoked_at === null),
        1
      )
      assert.isNotNull(rows.find((row) => row.id === old.id)!.revoked_at)
      assert.lengthOf(await app.database.from('remember_me_tokens'), 1)
      assert.lengthOf(
        await app.database.from('pupitre_login_events').where('method', 'remember'),
        0
      )
      const active = rows.find((row) => row.revoked_at === null)!
      const token = await app.database.from('remember_me_tokens').first()
      assert.equal(active.remember_token_id, String(token.id))
      const restored = await request(app, '/admin/profile', rememberOnly(cookies(completed)))
      assert.equal(restored.status, 200, await restored.clone().text())
      assert.lengthOf(await app.database.from('pupitre_user_sessions').whereNull('revoked_at'), 1)
    } finally {
      await cleanup(app)
    }
  })

  test('password login creates a private session row and records failed attempts without email', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      const actor = await user()
      await login(app, 'unknown@example.test')
      const failed = await app.database
        .from('pupitre_login_events')
        .where('event', 'failed')
        .first()
      assert.isNull(failed.user_id)
      assert.notInclude(JSON.stringify(failed), 'unknown@example.test')
      const cookie = cookies(await login(app))
      const rows = await app.database
        .from('pupitre_user_sessions')
        .where('user_id', String(actor.id))
      assert.lengthOf(rows, 1)
      assert.notInclude(cookie, rows[0].token_hash)
      assert.isTrue(new Date(rows[0].expires_at).getTime() > Date.now())
      const event = await app.database.from('pupitre_login_events').where('event', 'login').first()
      assert.equal(event.method, 'password')
    } finally {
      await cleanup(app)
    }
  })

  test('history widget requires the user-resource ability', async ({ assert }) => {
    const app = await fixture()
    try {
      const actor = await user()
      await user('other@example.test')
      const url = `/admin/_pupitre/widgets/login-history?resource=users&widgetPage=view&record=${actor.id}`
      const allowedCookie = cookies(await login(app))
      const deniedCookie = cookies(await login(app, 'other@example.test'))
      const allowed = await request(app, url, allowedCookie)
      assert.equal(allowed.status, 200)
      assert.include(await allowed.text(), 'password')
      const denied = await request(app, url, deniedCookie)
      assert.equal(denied.status, 403)
      // A denied viewer must not receive the widget, or its deferred load 403s on the page.
      const viewPage = (cookie: string) =>
        fetch(`${app.baseUrl}/admin/users/${actor.id}`, {
          headers: { 'Cookie': cookie, 'X-Inertia': 'true', 'Accept': 'text/html' },
        }).then((response) => response.text())
      assert.include(await viewPage(allowedCookie), 'widget_footer_login_history')
      assert.notInclude(await viewPage(deniedCookie), 'widget_footer_login_history')
    } finally {
      await cleanup(app)
    }
  })

  test('revocation checks ownership and identity and preserves the current session', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      const actor = await user()
      const one = cookies(await login(app))
      const two = cookies(await login(app))
      const rows = await app.database
        .from('pupitre_user_sessions')
        .where('user_id', String(actor.id))
      const foreign = { ...rows[0], id: randomUUID(), user_id: '99999' }
      await app.database.table('pupitre_user_sessions').insert(foreign)
      const forbidden = await request(app, `/admin/profile/sessions/${foreign.id}`, one, 'DELETE')
      assert.equal(forbidden.status, 404)
      const missing = await request(app, '/admin/profile/sessions/logout-others', one, 'POST', {})
      assert.equal(missing.status, 422)
      const confirmed = await request(app, '/admin/profile/sessions/logout-others', one, 'POST', {
        current_password: 'password',
      })
      assert.equal(confirmed.status, 204)
      const revoked = await request(app, '/admin/profile', two)
      assert.equal(revoked.headers.get('location'), '/admin/login')
      const current = await request(app, '/admin/profile', one)
      assert.equal(current.status, 200)
      const untouched = await app.database
        .from('pupitre_user_sessions')
        .where('id', foreign.id)
        .first()
      assert.isNull(untouched.revoked_at)
    } finally {
      await cleanup(app)
    }
  })

  test('expired and revoked sessions are excluded and the active list is newest first', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      await user()
      const cookie = cookies(await login(app))
      const current = await app.database.from('pupitre_user_sessions').first()
      const newerId = randomUUID()
      await app.database.table('pupitre_user_sessions').multiInsert([
        {
          ...current,
          id: randomUUID(),
          token_hash: 'expired',
          expires_at: DateTime.utc().minus({ minutes: 1 }).toSQL(),
        },
        { ...current, id: randomUUID(), token_hash: 'revoked', revoked_at: DateTime.utc().toSQL() },
        {
          ...current,
          id: newerId,
          token_hash: 'newer',
          created_at: DateTime.utc().plus({ seconds: 1 }).toSQL(),
        },
      ])
      const result = await request(app, '/admin/profile/sessions', cookie)
      const body = z
        .object({ sessions: z.array(z.object({ id: z.string() })) })
        .parse(await result.json())
      assert.deepEqual(
        body.sessions.map((row: { id: string }) => row.id),
        [newerId, current.id]
      )
    } finally {
      await cleanup(app)
    }
  })
  for (const behavior of ['redirect', 'notice']) {
    test(`URL tenancy revocation preserves the correct ${behavior}`, async ({ assert }) => {
      const tenantPanel = panel.tenancy({
        mode: 'url',
        adapter: {
          resolve: async () => ({ id: 1, name: 'Acme', slug: 'acme' }),
          listForUser: async () => [{ id: 1, name: 'Acme', slug: 'acme' }],
          scope() {},
          fill: (data) => data,
        },
      })
      const app = await fixture(tenantPanel)
      try {
        await user()
        const cookie = cookies(await login(app))
        await app.database
          .from('pupitre_user_sessions')
          .update({ revoked_at: DateTime.utc().toSQL() })
        const revoked = await request(app, '/admin/profile', cookie)
        if (behavior === 'redirect') assert.equal(revoked.headers.get('location'), '/admin/login')
        const loginPage = await fetch(`${app.baseUrl}/admin/login`, {
          headers: {
            'Cookie': cookies(revoked, cookie),
            'X-Inertia': 'true',
            'Accept': 'text/html',
          },
        })
        if (behavior === 'notice')
          assert.include(
            await loginPage.text(),
            'Your browser session was revoked. Please sign in again.'
          )
      } finally {
        await cleanup(app)
      }
    })
  }

  for (const entryPath of ['/admin/login', '/admin/profile']) {
    test(`remember-me reauthentication through ${entryPath} renews its listed browser session`, async ({
      assert,
    }) => {
      const realNow = Date.now
      const luxonNow = Settings.now
      const start = realNow()
      let now = start
      Date.now = () => now
      Settings.now = () => now
      const app = await createTestApp({
        panels: { admin: async () => ({ default: panel }) },
        pupitre: { auth: { ...userConfig, model: async () => ({ default: RememberUser }) } },
        config: {
          encryption: encryptionConfig({
            default: 'gcm',
            list: {
              gcm: drivers.aes256gcm({ keys: ['01234567890123456789012345678901'], id: 'gcm' }),
            },
          }),
          auth: authConfig({
            default: 'web',
            guards: {
              web: sessionGuard({
                useRememberMeTokens: true,
                rememberMeTokensAge: '3 days',
                provider: sessionUserProvider({ model: async () => ({ default: RememberUser }) }),
              }),
            },
          }),
        },
        setup(router) {
          router.get('/expire-auth', (ctx) => {
            ctx.session.forget('auth_web')
            return ctx.response.noContent()
          })
        },
      })
      await tables(app)
      await app.database.connection().schema.dropTableIfExists('remember_me_tokens')
      await app.database.connection().schema.createTable('remember_me_tokens', (table) => {
        table.increments('id')
        table.integer('tokenable_id').notNullable()
        table.string('hash').notNullable()
        table.timestamp('created_at')
        table.timestamp('updated_at')
        table.timestamp('expires_at')
      })
      try {
        await user()
        const response = await login(app, 'sessions@example.test', true)
        assert.equal(response.status, 302, await response.clone().text())
        const rememberCookie = cookies(response)
          .split('; ')
          .filter((pair) => pair.startsWith('remember_web='))
          .join('; ')
        assert.notEqual(rememberCookie, '')
        now = start + 2 * 86400000
        const returning = await request(app, entryPath, rememberCookie)
        assert.equal(
          returning.status,
          entryPath === '/admin/login' ? 302 : 200,
          await returning.clone().text()
        )
        let browserCookies = cookies(returning, rememberCookie)
        const rows = await app.database.from('pupitre_user_sessions').orderBy('created_at')
        assert.lengthOf(rows, 1)
        assert.isTrue(rows.every((row) => Boolean(row.remembered)))
        const restored = rows[0]!
        assert.closeTo(new Date(restored.expires_at).getTime(), start + 5 * 86400000, 1000)
        now = start + 4 * 86400000
        const listed = await request(app, '/admin/profile/sessions', browserCookies)
        assert.equal(listed.status, 200, await listed.clone().text())
        const listedBody = (await listed.json()) as { sessions: { id: string }[] }
        assert.include(
          listedBody.sessions.map((row) => row.id),
          restored.id
        )
        browserCookies = cookies(listed, browserCookies)
        const expiredAuth = await request(app, '/expire-auth', browserCookies)
        browserCookies = cookies(expiredAuth, browserCookies)
        const renewed = await request(app, '/admin/profile', browserCookies)
        assert.equal(renewed.status, 200, await renewed.clone().text())
        const renewedRow = await app.database
          .from('pupitre_user_sessions')
          .where('id', restored.id)
          .first()
        assert.closeTo(new Date(renewedRow.expires_at).getTime(), start + 7 * 86400000, 1000)
        assert.lengthOf(await app.database.from('pupitre_user_sessions'), 1)
        const event = await app.database
          .from('pupitre_login_events')
          .where('method', 'remember')
          .first()
        assert.equal(event.event, 'login')
      } finally {
        Date.now = realNow
        Settings.now = luxonNow
        await cleanup(app)
      }
    })
  }

  test('social controller creates a browser-session row', async ({ assert }) => {
    const app = await createTestApp({
      panels: { admin: async () => ({ default: panel.social(['fake']) }) },
      pupitre: { auth: userConfig },
      setup(router) {
        router.use([
          async () => ({
            default: class {
              async handle(ctx: HttpContext, next: () => Promise<void>) {
                const socialContext = ctx as HttpContext & { ally: unknown }
                socialContext.ally = {
                  use: () => ({
                    accessDenied: () => false,
                    stateMisMatch: () => false,
                    hasError: () => false,
                    user: async () => ({
                      id: 'linked',
                      email: 'sessions@example.test',
                      name: 'Sessions',
                      emailVerificationState: 'verified',
                    }),
                  }),
                }
                return next()
              }
            },
          }),
        ])
      },
    })
    await tables(app)
    try {
      const actor = await user()
      const response = await request(app, '/admin/auth/fake/callback', '')
      assert.equal(response.status, 302)
      assert.equal(response.headers.get('location'), '/admin')
      assert.lengthOf(
        await app.database.from('pupitre_user_sessions').where('user_id', String(actor.id)),
        1
      )
      const event = await app.database.from('pupitre_login_events').where('event', 'login').first()
      assert.equal(event.method, 'social:fake')
    } finally {
      await cleanup(app)
    }
  })

  test('MFA controller creates a row only after successful challenge completion', async ({
    assert,
  }) => {
    const app = await createTestApp({
      panels: { admin: async () => ({ default: panel.mfa() }) },
      pupitre: { auth: userConfig },
      config: {
        encryption: encryptionConfig({
          default: 'gcm',
          list: {
            gcm: drivers.aes256gcm({ keys: ['01234567890123456789012345678901'], id: 'gcm' }),
          },
        }),
      },
    })
    await tables(app)
    try {
      const actor = await user()
      const secret = generateSecret()
      const encryption = await app.app.container.make('encryption')
      await actor
        .merge({ mfaSecret: encryption.encrypt(secret), mfaEnabledAt: DateTime.utc() })
        .save()
      const pending = await login(app)
      assert.equal(pending.headers.get('location'), '/admin/mfa/challenge')
      assert.lengthOf(await app.database.from('pupitre_user_sessions'), 0)
      const completed = await request(app, '/admin/mfa/challenge', cookies(pending), 'POST', {
        code: await generate({ secret }),
      })
      assert.equal(completed.status, 302, await completed.clone().text())
      assert.lengthOf(
        await app.database.from('pupitre_user_sessions').where('user_id', String(actor.id)),
        1
      )
      const event = await app.database.from('pupitre_login_events').where('event', 'login').first()
      assert.equal(event.method, 'password')
    } finally {
      await cleanup(app)
    }
  })

  test('passkey controller creates a row after a verified assertion', async ({ assert }) => {
    const app = await fixture(panel.passkeys())
    try {
      const actor = await user()
      await app.database.table('pupitre_passkeys').insert({
        user_id: actor.id,
        credential_id: 'credential',
        public_key: 'AA',
        counter: 0,
        transports: '[]',
        device_type: 'singleDevice',
        backed_up: false,
        name: 'Test',
        created_at: DateTime.utc().toSQL(),
        updated_at: DateTime.utc().toSQL(),
      })
      // The external verifier is replaced, not the controller or persistence path.
      const api = webauthn
      setWebAuthnLoaderForTests(async () => ({
        ...api,
        generateAuthenticationOptions: async () => ({
          challenge: 'test',
          rpId: 'localhost',
          userVerification: 'preferred',
        }),
        verifyAuthenticationResponse: async () => ({
          verified: true,
          authenticationInfo: {
            credentialID: 'credential',
            newCounter: 1,
            userVerified: true,
            credentialBackedUp: false,
            credentialDeviceType: 'singleDevice',
            origin: 'http://localhost',
            rpID: 'localhost',
          },
        }),
      }))
      const options = await request(app, '/admin/passkeys/login/options', '')
      const assertion = {
        id: 'credential',
        rawId: 'credential',
        type: 'public-key',
        response: { clientDataJSON: 'AA', authenticatorData: 'AA', signature: 'AA' },
        clientExtensionResults: {},
      }
      const response = await request(
        app,
        '/admin/passkeys/login/verify',
        cookies(options),
        'POST',
        { credential: assertion }
      )
      assert.equal(response.status, 302, await response.clone().text())
      assert.lengthOf(
        await app.database.from('pupitre_user_sessions').where('user_id', String(actor.id)),
        1
      )
      const event = await app.database.from('pupitre_login_events').where('event', 'login').first()
      assert.equal(event.method, 'passkey')
    } finally {
      setWebAuthnLoaderForTests()
      await cleanup(app)
    }
  })

  test('the real Ace prune process starts the app and deletes expired history and sessions', async ({
    assert,
  }) => {
    const app = await fixture()
    try {
      await user()
      await login(app)
      const row = await app.database.from('pupitre_user_sessions').first()
      const expiredId = randomUUID()
      await app.database
        .table('pupitre_user_sessions')
        .insert({ ...row, id: expiredId, last_active_at: '2000-01-01T00:00:00Z' })
      await app.database
        .table('pupitre_login_events')
        .insert({ panel: 'admin', event: 'failed', created_at: '2000-01-01T00:00:00Z' })
      let started = false
      const ignitor = new IgnitorFactory()
        .withCoreConfig()
        .withCoreProviders()
        .merge({
          rcFileContents: {
            providers: [
              () => import('@adonisjs/lucid/database_provider'),
              () => import('../../../providers/pupitre_provider.js'),
            ],
          },
          config: { database: app.database.config, pupitre: defineConfig({ auth: userConfig }) },
        })
        .create(new URL(`file://${app.root}/`))
      await ignitor
        .ace()
        .configure(async (consoleApp) => {
          consoleApp.starting(async () => {
            const manager = await consoleApp.container.make('pupitre.manager')
            await manager.boot({ admin: async () => ({ default: panel }) })
            started = true
          })
          const ace = await consoleApp.container.make('ace')
          ace.addLoader(new ListLoader([PupitrePruneCommand]))
        })
        .handle(['pupitre:prune'])
      assert.isTrue(started)
      assert.isNull(await app.database.from('pupitre_user_sessions').where('id', expiredId).first())
      assert.lengthOf(await app.database.from('pupitre_user_sessions'), 1)
      assert.lengthOf(await app.database.from('pupitre_login_events'), 1)
    } finally {
      await cleanup(app)
    }
  })
})
