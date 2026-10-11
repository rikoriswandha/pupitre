import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { HttpRouterService } from '@adonisjs/core/types'
import { definePanel } from '../../../index.js'
import { closeTestApp, createTestApp, User } from '../../helpers/app.js'

const panel = definePanel('admin')
  .path('/admin')
  .login()
  .mfa({ issuer: 'Social tests' })
  .social({ providers: ['fake'], registration: true })
const options = {
  panels: { admin: async () => ({ default: panel }) },
  pupitre: {
    auth: {
      model: async () => ({ default: User }),
      columns: { name: 'name', socialProvider: 'provider', socialProviderId: 'providerId' },
    },
  },
  setup(router: HttpRouterService): void {
    router.use([
      async () => ({
        default: class FakeAllyMiddleware {
          async handle(ctx: HttpContext, next: NextFn) {
            ;(ctx as HttpContext & { ally: unknown }).ally = {
              use: () => ({
                async redirect() {
                  ctx.response.redirect('/oauth/fake')
                },
                accessDenied: () => ctx.request.input('status') === 'denied',
                stateMisMatch: () => ctx.request.input('status') === 'mismatch',
                hasError: () => ctx.request.input('status') === 'error',
                user: async () => ({
                  id: String(ctx.request.input('id', 'account-1')),
                  email: ctx.request.input('email', 'social@example.test'),
                  emailVerificationState:
                    ctx.request.input('verified', 'true') === 'true' ? 'verified' : 'unverified',
                  name: 'Social User',
                }),
              }),
            }
            return next()
          }
        },
      }),
    ])
  },
}

function post(url: string) {
  return fetch(url, { headers: { Accept: 'text/html' }, redirect: 'manual' })
}

test.group('Social login', () => {
  test('does not create accounts when both panel and social registration are disabled', async ({
    assert,
  }) => {
    const disabledPanel = definePanel('admin').path('/admin').login().social(['fake'])
    const fixture = await createTestApp({
      ...options,
      panels: { admin: async () => ({ default: disabledPanel }) },
    })
    try {
      const response = await post(
        `${fixture.baseUrl}/admin/auth/fake/callback?email=closed%40example.test&id=closed`
      )
      assert.equal(response.status, 302)
      assert.equal(response.headers.get('location'), '/admin/login')
      assert.isNull(await User.findBy('email', 'closed@example.test'))
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('links by provider identity before verified email fallback and rejects unverified email', async ({
    assert,
  }) => {
    const fixture = await createTestApp(options)
    try {
      const linked = await User.create({
        name: 'Linked',
        email: 'old@example.test',
        password: 'password',
        provider: 'fake',
        providerId: 'account-1',
      })
      const byProvider = await post(
        `${fixture.baseUrl}/admin/auth/fake/callback?email=other@example.test&id=account-1`
      )
      assert.equal(byProvider.status, 302)
      assert.equal(byProvider.headers.get('location'), '/admin')
      assert.equal(
        String(
          await User.query()
            .where('id', linked.id)
            .first()
            .then((user) => user?.email)
        ),
        'old@example.test'
      )

      await User.create({
        name: 'Email match',
        email: 'verified@example.test',
        password: 'password',
      })
      const byEmail = await post(
        `${fixture.baseUrl}/admin/auth/fake/callback?email=verified%40example.test&verified=true&id=account-2`
      )
      assert.equal(byEmail.headers.get('location'), '/admin')
      const unverified = await post(
        `${fixture.baseUrl}/admin/auth/fake/callback?email=verified%40example.test&verified=false&id=account-3`
      )
      assert.equal(unverified.headers.get('location'), '/admin/login')
      assert.isNull(await User.findBy('providerId', 'account-3'))
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('registration creates a verified linked identity and provider status errors return to login', async ({
    assert,
  }) => {
    const fixture = await createTestApp(options)
    try {
      const created = await post(
        `${fixture.baseUrl}/admin/auth/fake/callback?email=social-new%40example.test&id=account-new`
      )
      assert.equal(created.status, 302)
      assert.equal(created.headers.get('location'), '/admin')
      const user = await User.findBy('email', 'social-new@example.test')
      assert.isNotNull(user)
      assert.equal(user?.provider, 'fake')
      assert.equal(user?.providerId, 'account-new')
      for (const status of ['denied', 'mismatch', 'error']) {
        const response = await post(`${fixture.baseUrl}/admin/auth/fake/callback?status=${status}`)
        assert.equal(response.headers.get('location'), '/admin/login')
      }
      const unknown = await post(`${fixture.baseUrl}/admin/auth/other/callback`)
      assert.equal(unknown.status, 404)
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('redirect endpoint forwards to the configured Ally provider', async ({ assert }) => {
    const fixture = await createTestApp(options)
    try {
      const response = await post(`${fixture.baseUrl}/admin/auth/fake/redirect`)
      assert.equal(response.headers.get('location'), '/oauth/fake')
      const unknown = await post(`${fixture.baseUrl}/admin/auth/other/redirect`)
      assert.equal(unknown.status, 404)
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('uses the stored safe target without forwarding callback query parameters', async ({
    assert,
  }) => {
    const fixture = await createTestApp(options)
    try {
      const started = await post(
        `${fixture.baseUrl}/admin/auth/fake/redirect?redirect=${encodeURIComponent('https://evil.example/')}`
      )
      const cookie = started.headers.get('set-cookie')?.split(';', 1)[0]
      assert.equal(started.headers.get('location'), '/oauth/fake')
      assert.isDefined(cookie)

      const callback = await fetch(
        `${fixture.baseUrl}/admin/auth/fake/callback?email=safe%40example.test&id=safe-account`,
        {
          headers: { Accept: 'text/html', Cookie: cookie ?? '' },
          redirect: 'manual',
        }
      )
      assert.equal(callback.status, 302)
      assert.equal(callback.headers.get('location'), '/admin')

      const safeStarted = await post(
        `${fixture.baseUrl}/admin/auth/fake/redirect?redirect=${encodeURIComponent('/admin/reports?tab=recent')}`
      )
      const safeCookie = safeStarted.headers.get('set-cookie')?.split(';', 1)[0]
      const safeCallback = await fetch(
        `${fixture.baseUrl}/admin/auth/fake/callback?email=safe-target%40example.test&id=safe-target&status=ok`,
        {
          headers: { Accept: 'text/html', Cookie: safeCookie ?? '' },
          redirect: 'manual',
        }
      )
      assert.equal(safeCallback.headers.get('location'), '/admin/reports?tab=recent')
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('sends MFA-enabled social accounts to the MFA challenge', async ({ assert }) => {
    const fixture = await createTestApp(options)
    try {
      await User.create({
        name: 'MFA user',
        email: 'mfa@example.test',
        password: 'password',
        provider: 'fake',
        providerId: 'mfa-account',
        mfaEnabledAt: DateTime.now(),
      })
      const response = await post(
        `${fixture.baseUrl}/admin/auth/fake/callback?id=mfa-account&email=mfa%40example.test`
      )
      assert.equal(response.headers.get('location'), '/admin/mfa/challenge')
    } finally {
      await closeTestApp(fixture)
    }
  })
})
