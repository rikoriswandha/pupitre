import { test } from '@japa/runner'
import { defineConfig as defineLimiterConfig, stores } from '@adonisjs/limiter'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  Post,
  User,
} from '../../helpers/app.js'
import type { TestApplication } from '../../helpers/app.js'
import { teardown } from '../../helpers/db.js'

async function requestJson(fixture: TestApplication, path: string, cookie: string, body?: unknown) {
  const response = await fetch(`${fixture.baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Accept: 'application/json',
      Cookie: cookie,
      ...(body === undefined
        ? {}
        : { 'Content-Type': 'application/json', 'X-Pupitre-Action': '1' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { response, body: (await response.json()) as Record<string, unknown> }
}

async function makeUser(email: string) {
  return User.create({ name: email, fullName: email, email })
}

async function makePost() {
  return Post.create({
    title: 'Action extras test',
    slug: `action-extras-${Date.now()}-${Math.random()}`,
    status: 'draft',
    tenantId: 1,
  })
}

test.group('Pupitre ActionExtras integration', (group) => {
  let fixture: TestApplication
  group.setup(async () => {
    fixture = await createTestApp({
      providers: [() => import('@adonisjs/limiter/limiter_provider')],
      config: {
        limiter: defineLimiterConfig({
          default: 'memory',
          stores: { memory: stores.memory({}) },
        }),
      },
    })
  })
  group.teardown(async () => {
    await closeTestApp(fixture)
    await teardown()
    allowPolicyAbilities()
  })

  test('limits attempts per user and returns a 429 response after the configured maximum', async ({
    assert,
  }) => {
    const firstUser = await makeUser('rate-one@example.com')
    const secondUser = await makeUser('rate-two@example.com')
    const post = await makePost()
    const firstCookie = await fixture.loginAs(firstUser)
    const secondCookie = await fixture.loginAs(secondUser)
    const path = `/admin/posts/${post.id}/actions/rate-limit`

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await requestJson(fixture, path, firstCookie, { data: {} })
      assert.equal(result.response.status, 200, JSON.stringify(result.body))
    }
    const limited = await requestJson(fixture, path, firstCookie, { data: {} })
    assert.equal(limited.response.status, 429, JSON.stringify(limited.body))
    assert.equal(limited.body.message, 'Too many attempts. Please try again later.')
    assert.isNumber(limited.body.retryAfter)

    const isolated = await requestJson(fixture, path, secondCookie, { data: {} })
    assert.equal(isolated.response.status, 200, JSON.stringify(isolated.body))
  })

  test('deep-linked form GET remains subject to server authorization', async ({ assert }) => {
    const user = await makeUser('deep-link@example.com')
    const post = await makePost()
    const cookie = await fixture.loginAs(user)
    const path = `/admin/posts/${post.id}/actions/publish`

    const allowed = await requestJson(fixture, path, cookie)
    assert.equal(allowed.response.status, 200, JSON.stringify(allowed.body))

    const headerPath = `/admin/posts/actions/record-header?record=${post.id}`
    const headerAllowed = await requestJson(fixture, headerPath, cookie)
    assert.equal(headerAllowed.response.status, 200, JSON.stringify(headerAllowed.body))
    assert.include(JSON.stringify(headerAllowed.body.state), `"reason":"${post.title}"`)

    denyPolicyAbility('view')
    try {
      const hiddenForm = await requestJson(fixture, headerPath, cookie)
      assert.equal(hiddenForm.response.status, 403, JSON.stringify(hiddenForm.body))
      const hiddenRun = await requestJson(fixture, headerPath, cookie, {
        data: { reason: 'Not authorized' },
      })
      assert.equal(hiddenRun.response.status, 403, JSON.stringify(hiddenRun.body))
    } finally {
      allowPolicyAbilities()
    }

    denyPolicyAbility('publish')
    const denied = await requestJson(fixture, headerPath, cookie)
    assert.equal(denied.response.status, 403, JSON.stringify(denied.body))
    assert.equal(denied.body.message, 'You are not authorized to perform this action')
  })

  test('runs a nested modal footer action with the current modal data', async ({ assert }) => {
    const user = await makeUser('footer-action@example.com')
    const post = await makePost()
    const cookie = await fixture.loginAs(user)
    const path = `/admin/posts/${post.id}/actions/publish-preview`
    const result = await requestJson(fixture, path, cookie, {
      data: { reason: 'Needs review' },
    })
    assert.equal(result.response.status, 200, JSON.stringify(result.body))
    assert.deepEqual(result.body.flash, [{ type: 'info', title: 'Preview: Needs review' }])
  })
})
