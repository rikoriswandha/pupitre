import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import { E_PUPITRE_FORBIDDEN } from '../../../src/errors.js'
import { resolveTranslations } from '../../../src/i18n.js'

type HandledError = Error & { handle(error: Error, ctx: HttpContext): unknown }

test.group('E_PUPITRE_FORBIDDEN response handling', () => {
  test('returns JSON 403 for JSON requests', async ({ assert }) => {
    let response: { status: number; body: unknown } | undefined
    const error = new E_PUPITRE_FORBIDDEN()
    const ctx = {
      request: { header: (name: string) => (name === 'accept' ? 'application/json' : undefined) },
      response: {
        status(status: number) {
          return {
            json(body: unknown) {
              response = { status, body }
              return response
            },
          }
        },
      },
    } as unknown as HttpContext

    const handler = (error as unknown as HandledError).handle
    handler.call(error, error, ctx)
    assert.deepEqual(response, {
      status: 403,
      body: { message: 'You are not authorized to perform this action' },
    })
  })

  test('flashes the Pupitre error and redirects HTML requests back', async ({ assert }) => {
    const flashes: { key: string; value: unknown }[] = []
    let redirected = false
    const error = new E_PUPITRE_FORBIDDEN()
    const ctx = {
      request: { header: (name: string) => (name === 'accept' ? 'text/html' : undefined) },
      session: {
        flash(key: string, value: unknown) {
          flashes.push({ key, value })
        },
      },
      response: {
        redirect() {
          return {
            back() {
              redirected = true
              return 'redirected'
            },
          }
        },
      },
    } as unknown as HttpContext

    const handler = (error as unknown as HandledError).handle
    assert.equal(handler.call(error, error, ctx), 'redirected')
    assert.isTrue(redirected)
    assert.deepEqual(resolveTranslations(flashes, 'en'), [
      {
        key: 'pupitre',
        value: [
          {
            type: 'error',
            title: 'Forbidden',
            body: 'You are not authorized to perform this action',
          },
        ],
      },
    ])
  })
})
