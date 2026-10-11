import { randomUUID } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import { test } from '@japa/runner'
import { defineConfig, stores } from '@adonisjs/limiter'
import type { LimiterService } from '@adonisjs/limiter/types'
import AuthController from '../../../src/auth/controller.js'
import SocialAuthController from '../../../src/auth/social_controller.js'
import { authRateLimited } from '../../../src/auth/rate_limit.js'
import { consumeLoginLimit, clearLoginLimit } from '../../../src/drivers/limiter.js'
import { closeTestApp, createTestApp } from '../../helpers/app.js'

test('local fallback evicts oldest keys at capacity without locking out new identities', async ({
  assert,
}) => {
  const fixture = await createTestApp()
  try {
    const prefix = randomUUID()
    const oldest = `${prefix}:0`
    for (let attempt = 0; attempt < 5; attempt++) {
      assert.isFalse(await consumeLoginLimit(oldest))
    }
    assert.isTrue(await consumeLoginLimit(oldest))
    for (let index = 1; index < 10_000; index++) {
      assert.isFalse(await consumeLoginLimit(`${prefix}:${index}`))
    }
    const newest = `${prefix}:new`
    assert.isFalse(await consumeLoginLimit(newest))
    // Existing entries retain their counters; only the oldest identity is forgotten.
    for (let attempt = 1; attempt < 5; attempt++) {
      assert.isFalse(await consumeLoginLimit(newest))
    }
    assert.isTrue(await consumeLoginLimit(newest))
    assert.isFalse(await consumeLoginLimit(oldest))
  } finally {
    await closeTestApp(fixture)
  }
})
for (const installed of [false, true]) {
  test.group(`auth endpoint quotas (${installed ? 'installed limiter' : 'local fallback'})`, () => {
    test('blocks expensive auth handlers before config, validation, crypto, or mail work', async ({
      assert,
    }) => {
      const fixture = await createTestApp(
        installed
          ? {
              config: {
                limiter: defineConfig({ default: 'memory', stores: { memory: stores.memory({}) } }),
              },
              // Provider loaders intentionally exercise Adonis' lazy provider lifecycle.
              providers: [() => import('@adonisjs/limiter/limiter_provider')],
            }
          : {}
      )
      try {
        const controller = new AuthController()
        // [handler, quota action, attempts per minute before the handler is blocked]
        const cases = [
          ['login', 'login', 60],
          ['forgot', 'password-reset-request', 5],
          ['updatePassword', 'password-reset-consume', 5],
          ['register', 'register', 5],
          ['sendVerification', 'email-resend', 5],
          ['mfaSetup', 'mfa-setup', 5],
          ['mfaConfirm', 'mfa-confirm', 5],
          ['passkeyLoginOptions', 'passkey-login-options', 60],
          ['passkeyLoginVerify', 'passkey-login-verify', 60],
          ['passkeyRegisterOptions', 'passkey-register-options', 5],
          ['passkeyRegisterVerify', 'passkey-register-verify', 5],
        ] as const
        for (const format of ['json', 'inertia', 'html'] as const) {
          for (const [method, action, budget] of cases) {
            let status = 0
            let redirected = false
            let body: unknown
            const headers: Record<string, string> = {}
            const flashes: Record<string, unknown> = {}
            const response = {
              status(code: number) {
                status = code
                return this
              },
              header(name: string, value: string) {
                headers[name] = value
                return this
              },
              json(value: unknown) {
                body = value
                return value
              },
              redirect() {
                return {
                  back() {
                    status = 302
                    redirected = true
                  },
                }
              },
            }
            const ctx = {
              pupitre: { panel: { id: randomUUID() }, authUser: null },
              request: {
                ip: () => '127.0.0.1',
                header: () => (format === 'inertia' ? 'true' : undefined),
                accepts: () => (format === 'html' ? 'html' : 'json'),
                all() {
                  throw new Error('Rate-limited requests must not reach validation')
                },
              },
              session: {
                flash(key: string, value: unknown) {
                  flashes[key] = value
                },
              },
              response,
            } as unknown as Parameters<AuthController['login']>[0]
            const initialAttempts = budget === 60 ? 5 : 0
            for (let attempt = 0; attempt < initialAttempts; attempt++) {
              assert.isFalse(await authRateLimited(ctx, action, budget))
            }
            if (initialAttempts) {
              // This deliberately incomplete context throws after the quota guard.
              // The sixth sign-in must reach the handler, not return a throttle.
              await assert.rejects(() => controller[method](ctx))
              assert.equal(status, 0, method)
            }
            for (let attempt = initialAttempts ? 6 : 0; attempt < budget; attempt++) {
              assert.isFalse(await authRateLimited(ctx, action, budget))
            }
            await controller[method](ctx)
            assert.equal(headers['Retry-After'], '60')
            const message = 'Too many attempts. Try again in one minute.'
            if (format === 'json') {
              assert.equal(status, 429, method)
              assert.deepEqual(body, { message })
              assert.isFalse(redirected)
              assert.deepEqual(flashes, {})
            } else {
              assert.equal(status, 302, method)
              assert.isTrue(redirected)
              assert.isUndefined(body)
              const field =
                method === 'updatePassword'
                  ? 'password'
                  : method === 'mfaConfirm'
                    ? 'code'
                    : ['login', 'forgot', 'register'].includes(method)
                      ? 'email'
                      : undefined
              assert.deepEqual(
                flashes,
                field
                  ? { inputErrorsBag: { [field]: message } }
                  : { pupitre: [{ type: 'error', title: message }] }
              )
            }
            // Negotiating a redirect must not release the exhausted quota.
            assert.isTrue(await authRateLimited(ctx, action, budget))
            assert.isFalse(await authRateLimited(ctx, `${action}-other`, budget))
          }
        }

        let socialStatus = 0
        const socialResponse = {
          status(code: number) {
            socialStatus = code
            return this
          },
          header() {
            return this
          },
          json(body: unknown) {
            return body
          },
        }
        const socialCtx = {
          params: { provider: 'github' },
          pupitre: {
            panel: { id: randomUUID(), social: { providers: ['github'] } },
            authUser: null,
          },
          request: {
            ip: () => '127.0.0.1',
            header: () => undefined,
            accepts: () => 'json',
          },
          response: socialResponse,
        } as unknown as Parameters<SocialAuthController['callback']>[0]
        for (let attempt = 0; attempt < 5; attempt++) {
          assert.isFalse(await authRateLimited(socialCtx, 'social-callback', 60))
        }
        await assert.rejects(() => new SocialAuthController().callback(socialCtx))
        assert.equal(socialStatus, 0)
        for (let attempt = 6; attempt < 60; attempt++) {
          assert.isFalse(await authRateLimited(socialCtx, 'social-callback', 60))
        }
        await new SocialAuthController().callback(socialCtx)
        assert.equal(socialStatus, 429)
      } finally {
        await closeTestApp(fixture)
      }
    })

    test('clears only a verified credential budget and shares user quotas across IP changes', async ({
      assert,
    }) => {
      const fixture = await createTestApp(
        installed
          ? {
              config: {
                limiter: defineConfig({ default: 'memory', stores: { memory: stores.memory({}) } }),
              },
              // Provider loaders intentionally exercise Adonis' lazy provider lifecycle.
              providers: [() => import('@adonisjs/limiter/limiter_provider')],
            }
          : {}
      )
      try {
        const key = randomUUID()
        for (let attempt = 0; attempt < 5; attempt++) assert.isFalse(await consumeLoginLimit(key))
        assert.isTrue(await consumeLoginLimit(key))
        await clearLoginLimit(key)
        assert.isFalse(await consumeLoginLimit(key))
        const panel = { id: randomUUID() }
        const user = { $primaryKeyValue: randomUUID() }
        for (let attempt = 0; attempt < 6; attempt++) {
          const ctx = {
            pupitre: { panel, authUser: user },
            request: { ip: () => `192.0.2.${attempt}` },
          } as unknown as HttpContext
          assert.equal(await authRateLimited(ctx, 'email-resend'), attempt >= 5)
        }
      } finally {
        await closeTestApp(fixture)
      }
    })

    if (installed) {
      test('does not fail open when the configured limiter throws a dependency-looking error', async ({
        assert,
      }) => {
        const fixture = await createTestApp({
          config: {
            limiter: defineConfig({ default: 'memory', stores: { memory: stores.memory({}) } }),
          },
          // Provider loaders intentionally exercise Adonis' lazy provider lifecycle.
          providers: [() => import('@adonisjs/limiter/limiter_provider')],
        })
        const manager: LimiterService = await fixture.app.container.make('limiter.manager')
        const originalUse = manager.use
        try {
          manager.use = () => {
            throw new Error('@adonisjs/limiter backend is unavailable')
          }
          await assert.rejects(() => consumeLoginLimit(randomUUID()), /backend is unavailable/)
        } finally {
          manager.use = originalUse
          await closeTestApp(fixture)
        }
      })
    }
  })
}
