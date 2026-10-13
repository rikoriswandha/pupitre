import { setTimeout } from 'node:timers/promises'
import { test } from '@japa/runner'
import { HealthChecks, Result } from '@adonisjs/core/health'
import type { HttpContext } from '@adonisjs/core/http'
import { HealthRunner, safeHealthMeta, authorizeHealth, health } from '../index.js'

test('cache TTL and forced execution', async ({ assert }) => {
  let runs = 0
  let now = 0
  const checks = new HealthChecks().register([
    {
      name: 'test',
      async run() {
        runs++
        return Result.ok('Ready').toJSON()
      },
    },
  ])
  const runner = new HealthRunner(checks, 60, () => now)
  await runner.run()
  await runner.run()
  assert.equal(runs, 1)
  await runner.run(true)
  assert.equal(runs, 2)
  now = 60_000
  await runner.run()
  assert.equal(runs, 3)
})

test('concurrent forced and cached runs coalesce', async ({ assert }) => {
  let runs = 0
  const runner = new HealthRunner(
    new HealthChecks().register([
      {
        name: 'slow',
        async run() {
          runs++
          await setTimeout(10)
          return Result.ok('Ready').toJSON()
        },
      },
    ])
  )
  const [first, second, third] = await Promise.all([
    runner.run(),
    runner.run(true),
    runner.run(true),
  ])
  assert.equal(runs, 1)
  assert.strictEqual(first, second)
  assert.strictEqual(second, third)
})

test('failed check remains an error and metadata never exposes secrets', async ({ assert }) => {
  const runner = new HealthRunner(
    new HealthChecks().register([
      {
        name: 'database',
        async run() {
          return Result.failed('Unavailable', new Error('postgres://secret'))
            .setMetaData({
              used: 2,
              password: 'secret',
              connection: 'postgres://secret',
              memoryInBytes: { used: 12, password: 'nested secret' },
            })
            .toJSON()
        },
      },
    ])
  )
  const result = await runner.run()
  assert.equal(result.status, 'error')
  assert.equal(result.counts.error, 1)
  assert.deepEqual(JSON.parse(String(result.rows[0].measurements)), {
    used: 2,
    memoryInBytes: { used: 12 },
  })
  assert.notInclude(JSON.stringify(result), 'secret')
  assert.deepEqual(
    safeHealthMeta({ used: 'secret', limit: Infinity, error: { message: 'secret' } }),
    {}
  )
})

test('authorization fails closed and callback distinguishes tenants and users', async ({
  assert,
}) => {
  const denied = { pupitre: { tenant: { id: 2 }, user: { id: 2 } } } as unknown as HttpContext
  const allowed = { pupitre: { tenant: { id: 1 }, user: { id: 1 } } } as unknown as HttpContext
  assert.isFalse(await authorizeHealth(allowed, {}, {}))
  assert.isFalse(
    await authorizeHealth(allowed, {}, { policies: async () => ({ HealthPolicy: class {} }) })
  )
  const authorize = (ctx: HttpContext) => {
    const user = ctx.pupitre.user
    return (
      ctx.pupitre.tenant?.id === 1 &&
      Boolean(user && typeof user === 'object' && 'id' in user && user.id === 1)
    )
  }
  assert.isTrue(await authorizeHealth(allowed, { authorize }, {}))
  assert.isFalse(await authorizeHealth(denied, { authorize }, {}))
  const plugin = health({ checks: new HealthChecks(), authorize })
  assert.equal(plugin.name, 'health')
})

test('HealthPolicy view uses the host bouncer and denies absent bouncer', async ({ assert }) => {
  class HealthPolicy {
    view() {
      return true
    }
  }
  const config = { policies: async () => ({ HealthPolicy }) }
  assert.isFalse(await authorizeHealth({} as HttpContext, {}, config))
  const ctx = {
    bouncer: {
      with(policy: unknown) {
        assert.strictEqual(policy, HealthPolicy)
        return {
          async allows(ability: string) {
            assert.equal(ability, 'view')
            return false
          },
        }
      },
    },
  } as unknown as HttpContext
  assert.isFalse(await authorizeHealth(ctx, {}, config))
})

test('zero TTL executes each request and a runner rejection does not poison subsequent runs', async ({
  assert,
}) => {
  let calls = 0
  const checks = new HealthChecks().register([
    {
      name: 'recoverable',
      async run() {
        calls++
        if (calls === 1) throw new Error('Runner unavailable')
        return Result.ok('Recovered').toJSON()
      },
    },
  ])
  const runner = new HealthRunner(checks, 0)
  await assert.rejects(() => runner.run(), 'Runner unavailable')
  const result = await runner.run()
  assert.equal(result.status, 'ok')
  await runner.run()
  assert.equal(calls, 3)
})
