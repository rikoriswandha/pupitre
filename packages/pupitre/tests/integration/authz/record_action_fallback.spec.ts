import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import type { HttpRouterService } from '@adonisjs/core/types'
import type { ResourceRuntime } from '../../../src/manager.js'
import { authorizeResource } from '../../../src/authz/bouncer.js'
import { closeTestApp, createTestApp, fixturePostResource, Post } from '../../helpers/app.js'

class CreateAndUpdatePolicy {
  create() {
    return true
  }

  update() {
    return true
  }
}

const resource = {
  slug: 'posts',
  model: Post,
  definition: fixturePostResource.policy(CreateAndUpdatePolicy).toDefinition(),
} as unknown as ResourceRuntime

test.group('record action policy fallbacks', () => {
  test('falls back for replicate and reorder but denies missing restore and forceDelete abilities', async ({
    assert,
  }) => {
    const fixture = await createTestApp({
      setup: (router: HttpRouterService) => {
        router.get('/__test/record-action-fallback', async (ctx: HttpContext) => {
          return ctx.response.json({
            replicate: await authorizeResource(ctx, resource, 'replicate'),
            reorder: await authorizeResource(ctx, resource, 'reorder'),
            restore: await authorizeResource(ctx, resource, 'restore'),
            forceDelete: await authorizeResource(ctx, resource, 'forceDelete'),
          })
        })
      },
    })
    try {
      const response = await fetch(`${fixture.baseUrl}/__test/record-action-fallback`, {
        headers: { Accept: 'application/json' },
      })
      const responseBody = await response.text()
      assert.equal(response.status, 200, responseBody)
      assert.deepEqual(JSON.parse(responseBody), {
        replicate: true,
        reorder: true,
        restore: false,
        forceDelete: false,
      })
    } finally {
      await closeTestApp(fixture)
    }
  })
})
