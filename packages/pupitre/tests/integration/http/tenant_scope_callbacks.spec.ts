import { test } from '@japa/runner'
import {
  definePanel,
  defineResource,
  defineRelationManager,
  pages,
  schema,
  table,
} from '../../../index.js'
import type { TenancyAdapter } from '../../../src/definition/tenancy.js'
import RelationPost from '../../fixtures/models/relation_post.js'
import RelationTag from '../../fixtures/models/relation_tag.js'
import RelationRevision from '../../fixtures/models/relation_revision.js'
import { closeTestApp, createTestApp, testSessionAuthentication, User } from '../../helpers/app.js'
import { scopedQuery } from '../../../src/query/scoped_query.js'
import { applyTableQuery } from '../../../src/query/table_query.js'
import type { HttpContext } from '@adonisjs/core/http'

import { truncate } from '../../helpers/db.js'
const adapter: TenancyAdapter = {
  async resolve() {
    return { id: 1, name: 'Acme', slug: 'acme' }
  },
  scope(query, tenant) {
    query.where('tenant_id', tenant.id)
  },
  fill(data, tenant) {
    return { ...data, tenantId: tenant.id }
  },
  async listForUser() {
    return [{ id: 1, name: 'Acme', slug: 'acme' }]
  },
}
const resourcePages = {
  list: pages.list(),
  create: pages.create(),
  edit: pages.edit(),
  view: pages.view(),
}

for (const registered of [false, true]) {
  test(`tenant scope isolates callbacks and related options (registered=${registered})`, async ({
    assert,
  }) => {
    const tags = defineRelationManager(RelationPost, 'tags').table((t) =>
      t.columns([table.text('name')])
    )
    const posts = defineResource(RelationPost)
      .slug('posts')
      .relations([tags])
      .pages(resourcePages)
      .scope((query) =>
        query
          .where('title', 'Own A')
          .orWhere('title', 'Own B')
          .orderBy('title', 'desc')
          .preload('tags' as never)
      )
      .form(() => [
        schema.text('title').required(),
        schema
          .multiSelect('tagIds')
          .relationship('tags', 'name', (query) => query.orWhere('name', 'Visible'))
          .createOptionForm([schema.text('name').required()]),
        schema.multiSelect('revisionIds').relationship('revisions', 'title'),
      ])
    const tagResource = defineResource(RelationTag)
      .slug('tags')
      .pages(resourcePages)
      .scope((query) => query.where('name', 'Absent').orWhere('name', 'Visible'))
    const panel = definePanel('admin')
      .path('/admin')
      .guard('web')
      .middleware([testSessionAuthentication])
      .tenancy({ mode: 'url', ownership: 'tenant_id', adapter })
      .resources(registered ? { posts, tags: tagResource } : { posts })
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    await truncate()
    try {
      const user = await User.create({
        name: 'Actor',
        email: `callback-${Math.random()}@example.test`,
      })
      const cookie = await fixture.loginAs(user)
      const ownA = await RelationPost.create({ title: 'Own A', tenantId: 1 })
      const ownB = await RelationPost.create({ title: 'Own B', tenantId: 1 })
      await RelationPost.create({ title: 'Own A', tenantId: 2 })
      await RelationPost.create({ title: 'Own B', tenantId: 2 })
      const ownTag = await RelationTag.create({ name: 'Visible', tenantId: 1 })
      const foreignTag = await RelationTag.create({ name: 'Visible', tenantId: 2 })
      await ownA.related('tags').attach([ownTag.id, foreignTag.id])
      const revision = await RelationRevision.create({
        postId: ownA.id,
        title: 'Global',
        body: 'Body',
      })
      const manager = await fixture.app.container.make('pupitre.manager')
      const runtime = manager.getPanel('admin')!
      const ctx = {
        pupitre: { panel: runtime, tenant: { id: 1 }, tenancyAdapter: adapter },
        params: {},
      } as unknown as HttpContext
      const resource = runtime.resources.find((item) => item.slug === 'posts')!
      const rows = await scopedQuery(ctx, resource)
      assert.deepEqual(
        rows.map((row) => row.$primaryKeyValue),
        [ownB.id, ownA.id]
      )
      assert.lengthOf((rows[1] as RelationPost).tags, 2)
      const loaded = applyTableQuery(
        scopedQuery(ctx, resource),
        {
          columns: [],
          filters: [],
          paginated: false,
          filtersLayout: 'dropdown',
          searchDebounce: 300,
          striped: false,
          query: (query) => query.orWhere('title', 'Own A').orWhere('title', 'Own B'),
        },
        {},
        { ctx }
      )
      const tableRows = await loaded.query
      assert.deepEqual(
        tableRows.map((row) => row.$primaryKeyValue),
        [ownB.id, ownA.id]
      )
      const get = (path: string) =>
        fetch(`${fixture.baseUrl}/admin/acme${path}`, {
          headers: { Accept: 'application/json', Cookie: cookie, Connection: 'close' },
        })
      const options = await get('/_pupitre/options/posts/tagIds')
      assert.equal(options.status, 200, await options.clone().text())
      const optionBody = (await options.json()) as { options: { value: number }[] }
      assert.deepEqual(
        optionBody.options.map((option) => option.value),
        [ownTag.id]
      )
      const globals = await get('/_pupitre/options/posts/revisionIds')
      assert.equal(globals.status, 200)
      assert.include(
        ((await globals.json()) as { options: { value: number }[] }).options.map(
          (option) => option.value
        ),
        revision.id
      )
      const relation = await get(`/posts/${ownA.id}/relations/tags`)
      assert.equal(relation.status, 200)
      const body = (await relation.json()) as { rows: { key: number }[] }
      assert.deepEqual(
        body.rows.map((row) => row.key),
        [ownTag.id]
      )
      const post = (path: string, data: unknown) =>
        fetch(`${fixture.baseUrl}/admin/acme${path}`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Cookie': cookie,
            'Connection': 'close',
            'Content-Type': 'application/json',
            'X-Pupitre-Action': '1',
          },
          body: JSON.stringify({ data }),
        })
      const invalid = await post('/posts', { title: 'New', tagIds: [foreignTag.id] })
      assert.equal(invalid.status, 422, await invalid.clone().text())
      const created = await post('/_pupitre/options/posts/tagIds', { name: 'Created option' })
      assert.equal(created.status, 200, await created.clone().text())
      const createdBody = (await created.json()) as { option: { value: number } }
      const createdTag = await RelationTag.findOrFail(createdBody.option.value)
      assert.equal(createdTag.tenantId, 1)
    } finally {
      await closeTestApp(fixture)
    }
  })
}
