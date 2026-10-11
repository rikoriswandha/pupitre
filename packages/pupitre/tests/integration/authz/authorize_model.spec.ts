import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import type { HttpRouterService } from '@adonisjs/core/types'
import { authorizeModel } from '../../../src/authz/bouncer.js'
import { closeTestApp, createTestApp, Category } from '../../helpers/app.js'

class CategoryPolicy {
  viewAny() {
    return false
  }
}

function registerAuthorizationProbe(router: HttpRouterService) {
  router.get('/__test/related-authz', async (ctx: HttpContext) => {
    const allowed = await authorizeModel(ctx, Category, 'viewAny')
    return ctx.response.json({ allowed })
  })
}

test.group('authorizeModel', () => {
  test('uses the related model policy when configured', async ({ assert }) => {
    const fixture = await createTestApp({
      pupitre: { policies: async () => ({ CategoryPolicy }) },
      setup: (router) => registerAuthorizationProbe(router),
    })
    try {
      const response = await fetch(`${fixture.baseUrl}/__test/related-authz`, {
        headers: { Accept: 'application/json' },
      })
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { allowed: false })
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('allows access when the related model has no policy', async ({ assert }) => {
    const fixture = await createTestApp({
      pupitre: { policies: async () => ({}) },
      setup: (router) => registerAuthorizationProbe(router),
    })
    try {
      const response = await fetch(`${fixture.baseUrl}/__test/related-authz`, {
        headers: { Accept: 'application/json' },
      })
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { allowed: true })
    } finally {
      await closeTestApp(fixture)
    }
  })
})
