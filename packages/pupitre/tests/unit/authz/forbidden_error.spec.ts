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

  test('answers a forbidden GET of the referring URL instead of redirecting back to it', async ({
    assert,
  }) => {
    const flashes: unknown[] = []
    let redirected = false
    let response: { status: number; body: unknown } | undefined
    const error = new E_PUPITRE_FORBIDDEN()
    const ctx = (method: string, url: string) =>
      ({
        request: {
          header: (name: string) =>
            ({
              'accept': 'text/html, application/xhtml+xml',
              'x-inertia': 'true',
              'referer': 'http://pupitre.test/admin/acme/users/1?tab=a',
            })[name],
          method: () => method,
          url: () => url,
        },
        pupitre: { panel: { path: '/admin/acme' } },
        session: { flash: (_key: string, value: unknown) => flashes.push(value) },
        response: {
          status: (status: number) => ({
            json: (body: unknown) => (response = { status, body }),
          }),
          redirect: () => ({ back: () => (redirected = true) }),
        },
      }) as unknown as HttpContext
    const handler = (error as unknown as HandledError).handle

    // Inertia deferred-prop reloads re-request the current page; a redirect back loops.
    handler.call(error, error, ctx('GET', '/admin/acme/users/1/?tab=a'))
    assert.deepEqual(response, {
      status: 403,
      body: { message: 'You are not authorized to perform this action' },
    })
    assert.isFalse(redirected)
    assert.lengthOf(flashes, 0)

    // A different page, or a mutation of the same URL, still redirects back with the flash.
    handler.call(error, error, ctx('GET', '/admin/acme/users/1?tab=b'))
    handler.call(error, error, ctx('POST', '/admin/acme/users/1?tab=a'))
    assert.isTrue(redirected)
    assert.lengthOf(flashes, 2)
  })
})
