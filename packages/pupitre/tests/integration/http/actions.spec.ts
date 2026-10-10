import { test } from '@japa/runner'
import { actionFormResponse, actionResult } from '../../../catalog/wire.js'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  fixtureHookEventsSnapshot,
  Post,
  User,
  resetFixtureHooks,
} from '../../helpers/app.js'
import type { TestApplication } from '../../helpers/app.js'
import { teardown } from '../../helpers/db.js'
let csrfCookieHeader = ''
let csrfToken = ''
async function jsonRequest(
  baseUrl: string,
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  const method = options.method ?? (options.body !== undefined ? 'POST' : 'GET')
  const csrfHeaders = csrfToken
    ? method === 'GET'
      ? { Cookie: csrfCookieHeader }
      : { 'Cookie': csrfCookieHeader, 'X-XSRF-TOKEN': csrfToken }
    : {}
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Connection: 'close',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...csrfHeaders,
      ...options.headers,
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  })
  return { response, body: (await response.json()) as Record<string, any> }
}

async function createPost(overrides: Partial<Post> = {}) {
  return Post.create({
    title: 'Action test',
    slug: `action-${Date.now()}-${Math.random()}`,
    status: 'draft',
    tenantId: 1,
    ...overrides,
  })
}

let sharedFixture: TestApplication
test.group('Pupitre HTTP actions', (group) => {
  group.setup(async () => {
    sharedFixture = await createTestApp()
  })
  group.teardown(async () => {
    await closeTestApp(sharedFixture)
    await teardown()
  })
  test('returns a catalog-valid action form with fillForm data and validates submissions', async ({
    assert,
  }) => {
    const fixture = sharedFixture
    try {
      const post = await createPost()
      const form = await jsonRequest(fixture.baseUrl, `/admin/posts/${post.id}/actions/publish`)
      assert.equal(form.response.status, 200, JSON.stringify(form.body))
      assert.isTrue(actionFormResponse.safeParse(form.body).success)
      assert.deepEqual(form.body.state.data, { reason: 'fixture reason' })

      const invalid = await jsonRequest(
        fixture.baseUrl,
        `/admin/posts/${post.id}/actions/publish`,
        {
          method: 'POST',
          body: { data: {} },
          headers: { 'X-Pupitre-Action': '1' },
        }
      )
      assert.equal(invalid.response.status, 422, JSON.stringify(invalid.body))
      assert.isArray(invalid.body.errors.reason)
    } finally {
      allowPolicyAbilities()
    }
  })

  test('denies a crafted action request before applying its database effect', async ({
    assert,
  }) => {
    const fixture = sharedFixture
    try {
      const post = await createPost()
      denyPolicyAbility('publish')
      const result = await jsonRequest(fixture.baseUrl, `/admin/posts/${post.id}/actions/publish`, {
        method: 'POST',
        body: { data: { reason: 'ready' } },
        headers: { 'X-Pupitre-Action': '1' },
      })
      assert.equal(result.response.status, 403, JSON.stringify(result.body))
      assert.isString(result.body.message)
      const deniedPost = await Post.findOrFail(post.id)
      assert.equal(deniedPost.status, 'draft')
    } finally {
      allowPolicyAbilities()
    }
  })

  test('uses the submitted page URL as the default redirect, with a safe fallback', async ({
    assert,
  }) => {
    const fixture = sharedFixture
    const post = await createPost()
    const pageUrl = `/admin/posts?status=draft&page=2`
    const result = await jsonRequest(fixture.baseUrl, `/admin/posts/${post.id}/actions/publish`, {
      method: 'POST',
      body: { data: { reason: 'ready' } },
      headers: { 'X-Pupitre-Action': '1', 'X-Pupitre-Url': pageUrl },
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.body.redirect, pageUrl)

    const unsafe = await jsonRequest(fixture.baseUrl, `/admin/posts/${post.id}/actions/publish`, {
      method: 'POST',
      body: { data: { reason: 'again' } },
      headers: { 'X-Pupitre-Action': '1', 'X-Pupitre-Url': '//evil.example/' },
    })
    assert.equal(unsafe.response.status, 200)
    assert.equal(unsafe.body.redirect, '/admin/posts')
    assert.notEqual(unsafe.body.redirect, `/admin/posts/${post.id}/actions/publish`)
  })

  test('keeps JSON action flash out of the session', async ({ assert }) => {
    const fixture = sharedFixture
    const user = await User.create({
      name: 'Flash admin',
      email: `flash-${Date.now()}@example.test`,
    })
    const cookie = await fixture.loginAs(user)
    const post = await createPost()
    const action = await jsonRequest(fixture.baseUrl, `/admin/posts/${post.id}/actions/publish`, {
      method: 'POST',
      body: { data: { reason: 'ready' } },
      headers: { 'X-Pupitre-Action': '1', 'Cookie': cookie },
    })
    assert.equal(action.response.status, 200)
    assert.deepEqual(action.body.flash, [{ type: 'success', title: 'Published' }])
    const next = await fetch(`${fixture.baseUrl}/admin/posts`, {
      headers: {
        'Accept': 'text/html, application/xhtml+xml',
        'X-Inertia': 'true',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookie,
      },
    })
    const page = (await next.json()) as { props: { pupitre: { flash: unknown[] } } }
    assert.deepEqual(page.props.pupitre.flash, [])
  })

  test('runs valid row and bulk actions and returns ActionResult', async ({ assert }) => {
    const fixture = sharedFixture
    try {
      const post = await createPost({ tenantId: 1 })
      const published = await jsonRequest(
        fixture.baseUrl,
        `/admin/posts/${post.id}/actions/publish`,
        {
          method: 'POST',
          body: { data: { reason: 'ready' } },
          headers: { 'X-Pupitre-Action': '1' },
        }
      )
      assert.equal(published.response.status, 200, JSON.stringify(published.body))
      assert.isTrue(actionResult.safeParse(published.body).success)
      assert.deepEqual(published.body.flash, [{ type: 'success', title: 'Published' }])
      const publishedPost = await Post.findOrFail(post.id)
      assert.equal(publishedPost.status, 'published')

      const archive = await jsonRequest(
        fixture.baseUrl,
        `/admin/posts/${post.id}/actions/archive`,
        {
          method: 'POST',
          body: { data: { reason: 'ready' } },
          headers: { 'X-Pupitre-Action': '1' },
        }
      )
      assert.equal(archive.response.status, 200, JSON.stringify(archive.body))
      assert.isTrue(actionResult.safeParse(archive.body).success)
      assert.isTrue(archive.body.reload)
      assert.isTrue(archive.body.deselect)
      const archivedPost = await Post.findOrFail(post.id)
      assert.equal(archivedPost.status, 'archived')

      const scoped = await createPost({ tenantId: 1 })
      const outside = await createPost({ tenantId: 2 })
      const mixedInScope = await createPost({ tenantId: 1 })
      const bulk = await jsonRequest(fixture.baseUrl, '/admin/posts/actions/bulk-archive', {
        method: 'POST',
        body: { ids: [scoped.id] },
        headers: { 'X-Pupitre-Action': '1' },
      })
      assert.equal(bulk.response.status, 200, JSON.stringify(bulk.body))
      const scopedPost = await Post.findOrFail(scoped.id)
      assert.equal(scopedPost.status, 'archived')
      // Bulk ids are all-or-nothing: out-of-scope ids yield 404 and no handler records are processed.
      const outsideBatch = await jsonRequest(fixture.baseUrl, '/admin/posts/actions/bulk-archive', {
        method: 'POST',
        body: { ids: [mixedInScope.id, outside.id] },
        headers: { 'X-Pupitre-Action': '1' },
      })
      assert.equal(outsideBatch.response.status, 404, JSON.stringify(outsideBatch.body))
      const unchangedPost = await Post.findOrFail(mixedInScope.id)
      assert.equal(unchangedPost.status, 'draft')
      const outsidePost = await Post.findOrFail(outside.id)
      assert.equal(outsidePost.status, 'draft')
    } finally {
      allowPolicyAbilities()
    }
  })

  test('deletes rows through bulk and row routes with JSON results and hooks', async ({
    assert,
  }) => {
    resetFixtureHooks()
    const fixture = sharedFixture
    try {
      const bulkPost = await createPost({ tenantId: 1 })
      const outside = await createPost({ tenantId: 2 })
      const bulk = await jsonRequest(fixture.baseUrl, '/admin/posts/actions/delete', {
        method: 'POST',
        body: { ids: [bulkPost.id] },
        headers: { 'X-Pupitre-Action': '1' },
      })
      assert.equal(bulk.response.status, 200, JSON.stringify(bulk.body))
      assert.isTrue(actionResult.safeParse(bulk.body).success)
      assert.isNull(await Post.find(bulkPost.id))
      assert.isNotNull(await Post.find(outside.id))

      const rowPost = await createPost({ tenantId: 1 })
      const row = await fetch(`${fixture.baseUrl}/admin/posts/${rowPost.id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Connection': 'close',
          'X-Pupitre-Action': '1',
        },
      })
      const rowBody = (await row.json()) as Record<string, any>
      assert.equal(row.status, 200, JSON.stringify(rowBody))
      assert.isTrue(actionResult.safeParse(rowBody).success)
      assert.isNull(await Post.find(rowPost.id))
      assert.includeMembers(fixtureHookEventsSnapshot(), [
        `beforeDelete:${bulkPost.id}`,
        `afterDelete:${bulkPost.id}`,
        `beforeDelete:${rowPost.id}`,
        `afterDelete:${rowPost.id}`,
      ])
    } finally {
      allowPolicyAbilities()
    }
  })

  test('returns 404 for unknown and numeric action names without resolving them as records', async ({
    assert,
  }) => {
    const fixture = sharedFixture
    try {
      const unknown = await jsonRequest(fixture.baseUrl, '/admin/posts/actions/not-a-real-action')
      assert.equal(unknown.response.status, 404)
      assert.equal(unknown.body.message, 'Action not found')
      const numeric = await jsonRequest(fixture.baseUrl, '/admin/posts/actions/123')
      assert.equal(numeric.response.status, 404)
      assert.equal(numeric.body.message, 'Action not found')
    } finally {
      allowPolicyAbilities()
    }
  })
})

let csrfFixture: TestApplication
test.group('Pupitre HTTP action CSRF', (group) => {
  group.setup(async () => {
    csrfFixture = await createTestApp({ csrf: true })
    const user = await User.create({
      name: 'Action admin',
      email: `action-admin-${Date.now()}@test.local`,
    })
    csrfCookieHeader = await csrfFixture.loginAs(user)
    const xsrf = csrfCookieHeader.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='))
    if (!xsrf) throw new Error('Fixture login did not return the XSRF-TOKEN cookie')
    csrfToken = decodeURIComponent(xsrf.slice('XSRF-TOKEN='.length))
  })
  group.teardown(async () => {
    await closeTestApp(csrfFixture)
    await teardown()
  })

  test('rejects submissions without Shield CSRF and accepts the XSRF-TOKEN cookie value', async ({
    assert,
  }) => {
    const post = await createPost()
    const url = `${csrfFixture.baseUrl}/admin/posts/${post.id}/actions/publish`
    const body = JSON.stringify({ data: { reason: 'ready' } })
    const rejected = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Accept': 'application/json',
        'Connection': 'close',
        'Content-Type': 'application/json',
        'Cookie': csrfCookieHeader,
        'X-Pupitre-Action': '1',
      },
      body,
    })
    await rejected.arrayBuffer()
    assert.notEqual(rejected.status, 200)
    const rejectedPost = await Post.findOrFail(post.id)
    assert.equal(rejectedPost.status, 'draft')

    const accepted = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Accept': 'application/json',
        'Connection': 'close',
        'Content-Type': 'application/json',
        'Cookie': csrfCookieHeader,
        'X-XSRF-TOKEN': csrfToken,
        'X-Pupitre-Action': '1',
      },
      body,
    })
    assert.equal(accepted.status, 200, await accepted.text())
    const acceptedPost = await Post.findOrFail(post.id)
    assert.equal(acceptedPost.status, 'published')
  })
})
