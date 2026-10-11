import { truncate } from '../helpers/db.js'
import { test } from '@japa/runner'
import { action, definePanel, defineResource, pages, schema } from '../../index.js'
import type { TenancyAdapter } from '../../src/definition/tenancy.js'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  Post,
  PostPolicy,
  User,
} from '../helpers/app.js'
import { runAction, submitForm, visitResource } from '../../testing/index.js'

const hookOrder: string[] = []
const helperResource = defineResource(Post)
  .slug('posts')
  .label('Post')
  .policy(PostPolicy)
  .form((form) =>
    form.components([
      schema.text('title').required(),
      schema.text('slug').required(),
      schema.repeater('items').schema((fields) => [fields.text('sku').required()]),
    ])
  )
  .mutateBeforeCreate((data) => {
    hookOrder.push('mutateBeforeCreate')
    return data
  })
  .mutateBeforeSave((data) => {
    hookOrder.push('mutateBeforeSave')
    return data
  })
  .beforeCreate(() => hookOrder.push('beforeCreate'))
  .beforeSave(() => hookOrder.push('beforeSave'))
  .afterCreate(() => hookOrder.push('afterCreate'))
  .afterSave(() => hookOrder.push('afterSave'))
  .actions({
    row: [
      action('publish')
        .can('publish')
        .handle(async ({ record }) => {
          if (record instanceof Post) {
            await record.merge({ status: 'published' }).save()
          }
        }),
    ],
  })
  .pages({ create: pages.create(), edit: pages.edit(), list: pages.list(), view: pages.view() })

const helperPanel = definePanel('admin').path('/admin').resources({ posts: helperResource })

const adapter: TenancyAdapter = {
  async resolve(ctx) {
    const slug = ctx.params.tenant
    return slug === 'acme' || slug === 'globex'
      ? { id: slug === 'acme' ? 1 : 2, name: slug, slug }
      : null
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
    return [
      { id: 1, name: 'Acme', slug: 'acme' },
      { id: 2, name: 'Globex', slug: 'globex' },
    ]
  },
}

const tenantPanel = definePanel('admin')
  .path('/admin')
  .tenancy({ mode: 'url', adapter })
  .resources({ posts: helperResource.scope(() => {}) })

async function makeUser() {
  return User.create({
    name: `Testing ${Date.now()}`,
    email: `testing-${Date.now()}@example.test`,
  })
}

test.group('Pupitre public testing helpers', () => {
  test('matches HTTP authorization denial for resource creation', async ({ assert }) => {
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: helperPanel }) },
    })
    try {
      const actor = await makeUser()
      const cookie = await fixture.loginAs(actor)
      denyPolicyAbility('create')
      const response = await fetch(`${fixture.baseUrl}/admin/posts`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cookie': cookie,
        },
        body: JSON.stringify({ title: 'Denied', slug: 'denied' }),
      })
      assert.equal(response.status, 403)
      await assert.rejects(() =>
        submitForm(
          'posts',
          'create',
          { title: 'Denied', slug: 'denied' },
          {
            app: fixture.app,
            user: actor,
          }
        )
      )
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })

  test('maps nested validation errors and runs create hooks in order', async ({ assert }) => {
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: helperPanel }) },
    })
    hookOrder.length = 0
    try {
      const actor = await makeUser()
      const invalid = await submitForm(
        'posts',
        'create',
        { title: 'Nested', slug: 'nested', items: [{}] },
        { app: fixture.app, user: actor }
      )
      invalid.assertErrors({ 'items.0.sku': 'defined' })
      assert.equal(invalid.status, 422)
      const valid = await submitForm(
        'posts',
        'create',
        { title: 'Valid', slug: 'valid', items: [{ sku: 'SKU-1' }] },
        { app: fixture.app, user: actor }
      )
      valid.assertOk()
      assert.isDefined(valid.record)
      assert.equal(valid.record?.$attributes.slug, 'valid')
      assert.deepEqual(hookOrder, [
        'mutateBeforeCreate',
        'mutateBeforeSave',
        'beforeCreate',
        'beforeSave',
        'afterCreate',
        'afterSave',
      ])
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('hides foreign tenant records and dispatches actions through the controller', async ({
    assert,
  }) => {
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: tenantPanel }) },
    })
    try {
      await truncate()
      const actor = await makeUser()
      const foreign = await Post.create({
        title: 'Globex',
        slug: 'globex',
        status: 'draft',
        tenantId: 2,
      })
      await assert.rejects(
        () =>
          visitResource('posts', 'edit', {
            app: fixture.app,
            user: actor,
            tenant: { id: 1, name: 'acme', slug: 'acme' },
            record: foreign,
          }),
        /HTTP 404/
      )
      const own = await Post.create({ title: 'Acme', slug: 'acme', status: 'draft', tenantId: 1 })
      const result = await runAction('posts', 'publish', {
        app: fixture.app,
        user: actor,
        tenant: { id: 1, name: 'acme', slug: 'acme' },
        record: own,
      })
      assert.deepEqual(result.flash, [])
      await own.refresh()
      assert.equal(own.status, 'published')
      const edit = await visitResource('posts', 'edit', {
        app: fixture.app,
        user: actor,
        tenant: { id: 1, name: 'acme', slug: 'acme' },
        record: own,
      })
      assert.isDefined(edit.spec.elements['f.title'])
    } finally {
      await closeTestApp(fixture)
    }
  })
})
