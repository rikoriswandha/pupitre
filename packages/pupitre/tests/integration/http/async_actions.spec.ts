import type { TenancyAdapter } from '../../../src/definition/tenancy.js'
import type { JobsAdapter } from '../../../src/adapters/jobs.js'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  fixtureCategoryResource,
  fixturePanel,
  fixturePostResource,
  Post,
} from '../../helpers/app.js'
import { test } from '@japa/runner'
import { actionResult } from '../../../catalog/wire.js'
import { action, actions } from '../../../index.js'
import { setupSyncJobsAdapter } from '../../helpers/queue.js'
import type { TestApplication } from '../../helpers/app.js'
import User from '../../fixtures/models/user.js'
import { teardown } from '../../helpers/db.js'

test.group('Pupitre asynchronous bulk actions', (group) => {
  let fixture: TestApplication
  let teardownQueue: (() => Promise<void>) | undefined
  group.setup(async () => {
    const markPublished = action('mark-published')
      .label('Publish selected')
      .async()
      .handle(async ({ records }) => {
        for (const record of records ?? []) {
          const post = record as Post
          await post.merge({ status: 'published' }).save()
        }
      })
    const panel = fixturePanel.resources({
      posts: fixturePostResource.actions({
        header: [actions.create()],
        row: [],
        bulk: [markPublished],
      }),
      categories: fixtureCategoryResource,
    })
    const syncJobs = await setupSyncJobsAdapter()
    teardownQueue = syncJobs.teardown
    fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { jobs: syncJobs.adapter },
    })
  })
  group.each.setup(async () => {
    await Post.query().delete()
  })
  group.teardown(async () => {
    await closeTestApp(fixture)
    await teardownQueue?.()
    await teardown()
  })

  test('queues and re-resolves async bulk ids', async ({ assert }) => {
    const user = await User.create({
      name: 'Bulk actor',
      email: `bulk-${Math.random()}@example.test`,
    })
    const cookie = await fixture.loginAs(user)
    const post = await Post.create({
      title: 'Bulk candidate',
      slug: `bulk-${Math.random()}`,
      status: 'draft',
      tenantId: 1,
    })
    const foreign = await Post.create({
      title: 'Foreign candidate',
      slug: `foreign-${Math.random()}`,
      status: 'draft',
      tenantId: 2,
    })
    const response = await fetch(`${fixture.baseUrl}/admin/posts/actions/mark-published`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Pupitre-Action': '1',
        'Cookie': cookie,
        'Connection': 'close',
      },
      body: JSON.stringify({ ids: [post.id] }),
    })
    assert.equal(response.status, 200)
    const result = actionResult.parse(await response.json())
    assert.equal(result.flash[0]?.title, 'Queued Publish selected')
    const publishedPost = await Post.findOrFail(post.id)
    const untouchedPost = await Post.findOrFail(foreign.id)
    assert.equal(publishedPost.status, 'published')
    assert.equal(untouchedPost.status, 'draft')
    const denied = await fetch(`${fixture.baseUrl}/admin/posts/actions/mark-published`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Pupitre-Action': '1',
        'Cookie': cookie,
        'Connection': 'close',
      },
      body: JSON.stringify({ ids: [foreign.id] }),
    })
    assert.equal(denied.status, 404)
  })
  test('rechecks job abilities and rejects cross-tenant ids in the worker', async ({ assert }) => {
    const queuedJobs: { name: string; payload: Record<string, unknown> }[] = []
    const handlers = new Map<string, (payload: Record<string, unknown>) => Promise<void>>()
    const jobsAdapter: JobsAdapter = {
      register(name, handler) {
        handlers.set(name, handler)
      },
      async dispatch(name, payload) {
        queuedJobs.push({ name, payload })
      },
    }
    const publish = action('publish-queued')
      .async()
      .can('publish')
      .handle(async ({ records }) => {
        for (const record of records ?? []) {
          await (record as Post).merge({ status: 'published' }).save()
        }
      })
    const tenancyAdapter: TenancyAdapter = {
      async resolve(ctx) {
        return ctx.params.tenant === 'acme' ? { id: 1, name: 'Acme', slug: 'acme' } : null
      },
      scope(query, tenant, options) {
        query.where(options.ownership, tenant.id)
      },
      fill(data, tenant, options) {
        return {
          ...data,
          [options.ownership === 'tenant_id' ? 'tenantId' : options.ownership]: tenant.id,
        }
      },
      async listForUser() {
        return [{ id: 1, name: 'Acme', slug: 'acme' }]
      },
    }
    const panel = fixturePanel.tenancy({ mode: 'url', adapter: tenancyAdapter }).resources({
      posts: fixturePostResource.actions({ header: [], row: [], bulk: [publish] }),
      categories: fixtureCategoryResource,
    })
    const isolatedFixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { jobs: jobsAdapter },
    })
    try {
      allowPolicyAbilities()
      const user = await User.create({
        name: 'Queued policy actor',
        email: `queued-policy-${Math.random()}@example.test`,
      })
      const cookie = await isolatedFixture.loginAs(user)
      const localPost = await Post.create({
        title: 'Local queued record',
        slug: `local-queued-${Math.random()}`,
        status: 'draft',
        tenantId: 1,
      })
      const foreignPost = await Post.create({
        title: 'Foreign queued record',
        slug: `foreign-queued-${Math.random()}`,
        status: 'draft',
        tenantId: 2,
      })
      const queueSelected = async () =>
        fetch(`${isolatedFixture.baseUrl}/admin/acme/posts/actions/publish-queued`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Pupitre-Action': '1',
            'Cookie': cookie,
            'Connection': 'close',
          },
          body: JSON.stringify({ ids: [localPost.id] }),
        })
      const response = await queueSelected()
      assert.equal(response.status, 200, await response.clone().text())
      const job = queuedJobs[0]
      if (!job) throw new Error('The bulk job was not queued')
      const handler = handlers.get('pupitre.bulk')
      if (!handler) throw new Error('The bulk job handler was not registered')
      const serializedPayload = JSON.parse(JSON.stringify(job.payload)) as Record<string, unknown>
      serializedPayload.ids = [localPost.id, foreignPost.id]
      await assert.rejects(() => handler(serializedPayload))
      const untouchedForeign = await Post.findOrFail(foreignPost.id)
      assert.equal(untouchedForeign.status, 'draft')
      const unavailableTenantPayload = JSON.parse(JSON.stringify(job.payload)) as Record<
        string,
        unknown
      >
      unavailableTenantPayload.tenantId = 2
      await assert.rejects(() => handler(unavailableTenantPayload))

      const authorizedRequest = await queueSelected()
      assert.equal(authorizedRequest.status, 200)
      const permissionJob = queuedJobs[1]
      if (!permissionJob) throw new Error('The second bulk job was not queued')
      denyPolicyAbility('publish')
      await assert.rejects(() => handler(permissionJob.payload))
      const untouchedLocal = await Post.findOrFail(localPost.id)
      assert.equal(untouchedLocal.status, 'draft')
    } finally {
      allowPolicyAbilities()
      await closeTestApp(isolatedFixture)
    }
  })
  test('runs an async-marked bulk action synchronously without a jobs adapter', async ({
    assert,
  }) => {
    const markPublished = action('mark-published')
      .async()
      .handle(async ({ records }) => {
        for (const record of records ?? []) {
          const post = record as Post
          await post.merge({ status: 'published' }).save()
        }
      })
    const panel = fixturePanel.resources({
      posts: fixturePostResource.actions({
        header: [actions.create()],
        row: [],
        bulk: [markPublished],
      }),
      categories: fixtureCategoryResource,
    })
    const syncFixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const post = await Post.create({
        title: 'Sync fallback',
        slug: `sync-fallback-${Math.random()}`,
        status: 'draft',
        tenantId: 1,
      })
      const response = await fetch(`${syncFixture.baseUrl}/admin/posts/actions/mark-published`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pupitre-Action': '1' },
        body: JSON.stringify({ ids: [post.id] }),
      })
      assert.equal(response.status, 200)
      const updatedPost = await Post.findOrFail(post.id)
      assert.equal(updatedPost.status, 'published')
    } finally {
      await closeTestApp(syncFixture)
    }
  })
})
