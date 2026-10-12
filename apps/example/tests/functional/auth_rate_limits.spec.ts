import { createHash, randomUUID } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import { test } from '@japa/runner'
import { consumeLoginLimit } from '@rikology/pupitre/drivers/limiter'
import SessionController from '#controllers/session_controller'
import NewAccountController from '#controllers/new_account_controller'

// Budgets mirror the controllers: login shares the 60/minute IP-wide sign-in quota, registration 5/minute.
for (const [action, Controller, budget] of [
  ['login', SessionController, 60],
  ['register', NewAccountController, 5],
] as const) {
  for (const format of ['json', 'inertia', 'html'] as const) {
    test(`host ${action} throttles ${format} before validation and account work`, async ({
      assert,
    }) => {
      const ip = randomUUID()
      const key = createHash('sha256').update(`example:${action}:${ip}`).digest('hex')
      for (let attempt = 0; attempt < budget; attempt++)
        assert.isFalse(await consumeLoginLimit(key, budget))
      let status = 0
      let retryAfter = ''
      let redirected = false
      let body: unknown
      const flashes: Record<string, unknown> = {}
      const response = {
        status(code: number) {
          status = code
          return this
        },
        header(name: string, value: string) {
          if (name === 'Retry-After') retryAfter = value
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
        request: {
          ip: () => ip,
          header: () => (format === 'inertia' ? 'true' : undefined),
          accepts: () => (format === 'html' ? 'html' : 'json'),
          validateUsing() {
            throw new Error('Rate-limited requests must not reach validation')
          },
        },
        session: {
          flash(name: string, value: unknown) {
            flashes[name] = value
          },
        },
        response,
      } as unknown as HttpContext
      await new Controller().store(ctx)
      assert.equal(retryAfter, '60')
      const message = `Too many ${action === 'login' ? 'login' : 'registration'} attempts. Try again in one minute.`
      if (format === 'json') {
        assert.equal(status, 429)
        assert.deepEqual(body, { message })
        assert.isFalse(redirected)
        assert.deepEqual(flashes, {})
      } else {
        assert.equal(status, 302)
        assert.isTrue(redirected)
        assert.isUndefined(body)
        assert.deepEqual(flashes, { inputErrorsBag: { email: message } })
      }
      assert.isTrue(await consumeLoginLimit(key, budget))
      assert.isFalse(
        await consumeLoginLimit(createHash('sha256').update(`example:other:${ip}`).digest('hex'))
      )
    })
  }
}
