import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import { scope } from '@adonisjs/lucid/orm'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { definePanel, defineResource, pages } from '../../../index.js'
import RelationPost from '../../fixtures/models/relation_post.js'
import RelationRevision from '../../fixtures/models/relation_revision.js'
import { closeTestApp, createTestApp } from '../../helpers/app.js'
import { scopedQuery } from '../../../src/query/scoped_query.js'
import { applyTableQuery } from '../../../src/query/table_query.js'
import { applyGroupedScope } from '../../../src/query/grouped_scope.js'

import type { TenancyAdapter } from '../../../src/definition/tenancy.js'
import { truncate } from '../../helpers/db.js'
class ScopedPost extends RelationPost {
  static table = 'relation_posts'
  static alternatives = scope((query) => query.where('title', 'First').orWhere('title', 'Second'))
  static tenantOne = scope((query) => query.where('tenantId', 1))
}

for (const variant of ['table orHas', 'scope orHas', 'withScopes', 'apply', 'conditionals']) {
  test(`groups ${variant} predicates in order without escaping tenant scope`, async ({
    assert,
  }) => {
    let posts = defineResource(ScopedPost).slug('posts').pages({ list: pages.list() })
    if (variant === 'scope orHas')
      posts = posts.scope((query) =>
        (query as ModelQueryBuilderContract<typeof ScopedPost>)
          .where('title', 'First')
          .orHas('revisions')
      )
    if (variant === 'withScopes')
      posts = posts.scope((query) =>
        (query as ModelQueryBuilderContract<typeof ScopedPost>).withScopes((scopes) =>
          scopes.alternatives()
        )
      )
    if (variant === 'apply')
      posts = posts.scope((query) =>
        (query as ModelQueryBuilderContract<typeof ScopedPost>).apply((scopes) =>
          scopes.alternatives()
        )
      )
    if (variant === 'conditionals')
      posts = posts.scope((query) =>
        query
          .if(true, (builder) => builder.where('title', 'First'))
          .unless(false, (builder) => builder.orWhere('title', 'Second'))
          .match([true, (builder) => builder.orWhere('title', 'Third')])
      )
    const adapter: TenancyAdapter = {
      async resolve() {
        return { id: 1, name: 'Tenant one' }
      },
      scope(query) {
        query.where('tenantId', 1)
      },
      fill(data) {
        return data
      },
      async listForUser() {
        return []
      },
    }
    const panel = definePanel('admin')
      .path('/admin')
      .tenancy({ mode: 'url', ownership: 'tenant_id', adapter })
      .resources({ posts })
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      await truncate()
      const first = await ScopedPost.create({ title: 'First', tenantId: 1 })
      const second = await ScopedPost.create({ title: 'Second', tenantId: 1 })
      const foreign = await ScopedPost.create({ title: 'Second', tenantId: 2 })
      await ScopedPost.create({ title: 'First', tenantId: 2 })
      await ScopedPost.create({ title: 'Excluded', tenantId: 1 })
      for (const post of [second, foreign])
        await RelationRevision.create({ postId: post.id, title: 'Revision', body: 'Body' })
      const manager = await fixture.app.container.make('pupitre.manager')
      const runtime = manager.getPanel('admin')!
      const ctx = {
        params: {},
        pupitre: { panel: runtime, tenant: { id: 1 }, tenancyAdapter: adapter },
      } as unknown as HttpContext
      let query = scopedQuery(ctx, runtime.resources[0]!)
      if (variant === 'table orHas')
        query = applyTableQuery(
          query,
          {
            columns: [],
            filters: [],
            paginated: false,
            filtersLayout: 'dropdown',
            searchDebounce: 300,
            striped: false,
            query: (builder) =>
              (builder as ModelQueryBuilderContract<typeof ScopedPost>)
                .where('title', 'First')
                .orHas('revisions'),
          },
          {},
          { ctx }
        ).query
      const rows = await query.orderBy('id')
      assert.deepEqual(
        rows.map((row) => row.$primaryKeyValue),
        [first.id, second.id]
      )
    } finally {
      await closeTestApp(fixture)
    }
  })
}

for (const method of ['withScopes', 'apply'] as const) {
  test(`successive grouped ${method} callbacks keep tenant and filter predicates separate`, async ({
    assert,
  }) => {
    const fixture = await createTestApp()
    try {
      await truncate()
      const expected = await ScopedPost.create({ title: 'First', tenantId: 1 })
      await ScopedPost.create({ title: 'Excluded', tenantId: 1 })
      await ScopedPost.create({ title: 'Second', tenantId: 2 })
      const query = ScopedPost.query()
      applyGroupedScope(query, (builder) =>
        (builder as ModelQueryBuilderContract<typeof ScopedPost>)[method]((scopes) =>
          scopes.tenantOne()
        )
      )
      applyGroupedScope(query, (builder) =>
        (builder as ModelQueryBuilderContract<typeof ScopedPost>)[method]((scopes) =>
          scopes.alternatives()
        )
      )
      const rows = await query
      assert.deepEqual(
        rows.map((row) => row.id),
        [expected.id]
      )
    } finally {
      await closeTestApp(fixture)
    }
  })
}

test('nested parent remains mandatory for both branches of the child host scope', async ({
  assert,
}) => {
  const revisions = defineResource(RelationRevision)
    .slug('revisions')
    .parent(RelationPost, 'post')
    .scope((query) => query.where('title', 'Published').orWhere('title', 'Pinned'))
    .pages({ list: pages.list() })
  const posts = defineResource(RelationPost)
    .slug('relation-posts')
    .nested([revisions])
    .pages({ list: pages.list() })
  const fixture = await createTestApp({
    panels: {
      admin: async () => ({ default: definePanel('admin').path('/admin').resources({ posts }) }),
    },
  })
  try {
    const own = await RelationPost.create({ title: 'Own', tenantId: 1 })
    const other = await RelationPost.create({ title: 'Other', tenantId: 1 })
    const expected = []
    for (const parent of [own, other])
      for (const title of ['Published', 'Pinned', 'Excluded']) {
        const record = await RelationRevision.create({ postId: parent.id, title, body: 'Body' })
        if (parent === own && title !== 'Excluded') expected.push(record.id)
      }
    const manager = await fixture.app.container.make('pupitre.manager')
    const panel = manager.getPanel('admin')!
    const resource = panel.resources.find((item) => item.slug === 'revisions')!
    const ctx = { params: { parentId: own.id }, pupitre: { panel } } as unknown as HttpContext
    const rows = await scopedQuery(ctx, resource).orderBy('id')
    assert.deepEqual(
      rows.map((row) => row.$primaryKeyValue),
      expected
    )
    const unbound = { params: {}, pupitre: { panel } } as unknown as HttpContext
    assert.isEmpty(await scopedQuery(unbound, resource))
  } finally {
    await closeTestApp(fixture)
  }
})
