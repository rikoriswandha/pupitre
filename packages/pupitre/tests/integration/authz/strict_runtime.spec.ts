import { test } from '@japa/runner'
import { authorizeModel } from '../../../src/authz/bouncer.js'
import { closeTestApp, createTestApp, Category } from '../../helpers/app.js'
import {
  definePanel,
  defineResource,
  defineRelationManager,
  defineWidget,
  schema,
  table,
} from '../../../index.js'
import { fixturePanel, fixturePostResource } from '../../helpers/app.js'
import RelationPost from '../../fixtures/models/relation_post.js'
import type PupitreManager from '../../../src/manager.js'

class ParentPolicy {
  viewAny() {
    return true
  }
  view() {
    return true
  }
}

class EmptyPolicy {}

for (const strict of [false, true]) {
  test(`policy-less related model ${strict ? 'denies' : 'allows'} HTTP access`, async ({
    assert,
  }) => {
    const fixture = await createTestApp({
      pupitre: { policies: async () => ({}) },
      setup(router) {
        router.get('/__test/strict-related', async (ctx) => {
          ctx.pupitre = { panel: { resources: [], strictAuthorization: strict } } as never
          const allowed = await authorizeModel(ctx, Category, 'viewAny')
          return ctx.response.status(allowed ? 200 : 403).json({ allowed })
        })
      },
    })
    try {
      const response = await fetch(`${fixture.baseUrl}/__test/strict-related`, {
        headers: { Accept: 'application/json' },
      })
      assert.equal(response.status, strict ? 403 : 200)
      assert.deepEqual(await response.json(), { allowed: !strict })
    } finally {
      await closeTestApp(fixture)
    }
  })
}

test('present policy without ability or fallback denies in default and strict modes', async ({
  assert,
}) => {
  const fixture = await createTestApp({
    pupitre: { policies: async () => ({ CategoryPolicy: EmptyPolicy }) },
    setup(router) {
      router.get('/__test/missing-ability', async (ctx) => {
        ctx.pupitre = {
          panel: { resources: [], strictAuthorization: ctx.request.input('strict') === 'true' },
        } as never
        return ctx.response.json({ allowed: await authorizeModel(ctx, Category, 'attach') })
      })
    },
  })
  try {
    for (const strict of [false, true]) {
      const response = await fetch(`${fixture.baseUrl}/__test/missing-ability?strict=${strict}`)
      assert.deepEqual(await response.json(), { allowed: false })
    }
  } finally {
    await closeTestApp(fixture)
  }
})

test('strict relationship options deny a policy-less related model before querying', async ({
  assert,
}) => {
  const fixture = await createTestApp({
    pupitre: { policies: async () => ({}) },
    panels: {
      admin: async () => ({
        default: fixturePanel
          .strictAuthorization()
          .resources([
            fixturePostResource.form(() => [
              schema.select('categoryId').relationship('category', 'name'),
            ]),
          ]),
      }),
    },
  })
  try {
    const response = await fetch(`${fixture.baseUrl}/admin/_pupitre/options/posts/categoryId`, {
      headers: { Accept: 'application/json' },
    })
    assert.equal(response.status, 403)
  } finally {
    await closeTestApp(fixture)
  }
})

test('strict relation tables deny a model that loses its policy and retain parent tenant isolation', async ({
  assert,
}) => {
  const resource = defineResource(RelationPost)
    .slug('parents')
    .policy(ParentPolicy)
    .scope((query) => query.where('tenantId', 1))
    .relations([
      defineRelationManager(RelationPost, 'comments')
        .readOnly()
        .table((builder) => builder.columns([table.text('title')])),
    ])
  const fixture = await createTestApp({
    pupitre: { policies: async () => ({}) },
    panels: { admin: async () => ({ default: definePanel('admin').resources([resource]) }) },
  })
  try {
    const parent = await RelationPost.create({ title: 'Own parent', tenantId: 1 })
    const other = await RelationPost.create({ title: 'Other tenant', tenantId: 2 })
    const manager = (await fixture.app.container.make('pupitre.manager')) as PupitreManager
    manager.panels[0].strictAuthorization = true
    const denied = await fetch(`${fixture.baseUrl}/admin/parents/${parent.id}/relations/comments`, {
      headers: { Accept: 'application/json' },
    })
    assert.equal(denied.status, 403)
    const outside = await fetch(`${fixture.baseUrl}/admin/parents/${other.id}/relations/comments`, {
      headers: { Accept: 'application/json' },
    })
    assert.equal(outside.status, 404)
  } finally {
    await closeTestApp(fixture)
  }
})

test('strict table widgets deny policy-less non-resource models at runtime', async ({ assert }) => {
  const widget = defineWidget('categories', Category)
    .lazy(false)
    .table((builder) => builder.columns([table.text('name')]))
  const fixture = await createTestApp({
    pupitre: { policies: async () => ({}) },
    panels: { admin: async () => ({ default: definePanel('admin').widgets([widget]) }) },
  })
  try {
    await Category.create({ name: 'Private row' })
    const path = `${fixture.baseUrl}/admin/_pupitre/widgets/categories`
    const allowed = await fetch(path, { headers: { Accept: 'application/json' } })
    assert.equal(allowed.status, 200)
    const manager = (await fixture.app.container.make('pupitre.manager')) as PupitreManager
    manager.panels[0].strictAuthorization = true
    const denied = await fetch(path, { headers: { Accept: 'application/json' } })
    assert.equal(denied.status, 403)
    assert.notInclude(await denied.text(), 'Private row')
  } finally {
    await closeTestApp(fixture)
  }
})
