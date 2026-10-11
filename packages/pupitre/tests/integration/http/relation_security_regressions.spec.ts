import { test } from '@japa/runner'
import {
  action,
  actions,
  definePanel,
  defineRelationManager,
  defineResource,
  pages,
  schema,
  table,
} from '../../../index.js'
import type { TenancyAdapter } from '../../../src/definition/tenancy.js'
import RelationPost from '../../fixtures/models/relation_post.js'
import RelationTag from '../../fixtures/models/relation_tag.js'
import RelationRevision from '../../fixtures/models/relation_revision.js'
import { closeTestApp, createTestApp, testSessionAuthentication, User } from '../../helpers/app.js'
import type { TestApplication } from '../../helpers/app.js'

async function request(
  fixture: TestApplication,
  cookie: string,
  path: string,
  data?: Record<string, unknown>
) {
  return fetch(`${fixture.baseUrl}${path}`, {
    method: data ? 'POST' : 'GET',
    headers: {
      Accept: 'application/json',
      Cookie: cookie,
      Connection: 'close',
      ...(data ? { 'Content-Type': 'application/json', 'X-Pupitre-Action': '1' } : {}),
    },
    ...(data ? { body: JSON.stringify({ data }) } : {}),
  })
}

class TagPolicy {
  viewAny() {
    return true
  }
  view() {
    return false
  }
  update() {
    return true
  }
  publish() {
    return true
  }
}

const resourcePages = {
  list: pages.list(),
  create: pages.create(),
  edit: pages.edit(),
  view: pages.view(),
}

test.group('Relation security regressions', () => {
  test('custom row actions require view before filling forms or executing handlers', async ({
    assert,
  }) => {
    let filled = false
    let executed = false
    const inspect = action('inspect-private')
      .form([schema.text('name')])
      .fillForm(({ record }) => {
        filled = true
        return { name: (record as RelationTag).name }
      })
      .handle(() => {
        executed = true
      })
    const publish = action('publish-private')
      .can('publish')
      .form([schema.text('name')])
      .fillForm(({ record }) => {
        filled = true
        return { name: (record as RelationTag).name }
      })
      .handle(() => {
        executed = true
      })
    const tags = defineRelationManager(RelationPost, 'tags')
      .table((t) => t.columns([table.text('name')]))
      .actions({ header: [], row: [inspect, publish], bulk: [] })
    const posts = defineResource(RelationPost).slug('posts').relations([tags]).pages(resourcePages)
    const tagResource = defineResource(RelationTag)
      .slug('tags')
      .policy(TagPolicy)
      .pages(resourcePages)
    const panel = definePanel('admin')
      .path('/admin')
      .guard('web')
      .middleware([testSessionAuthentication])
      .resources({ posts, tags: tagResource })
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const user = await User.create({
        name: 'Relation actor',
        email: `relation-security-${Math.random()}@example.test`,
      })
      const cookie = await fixture.loginAs(user)
      const parent = await RelationPost.create({ title: 'Parent', tenantId: 1 })
      const tag = await RelationTag.create({ name: 'Private related record', tenantId: 1 })
      await parent.related('tags').attach([tag.id])
      for (const name of ['inspect-private', 'publish-private']) {
        const path = `/admin/posts/${parent.id}/relations/tags/${tag.id}/actions/${name}`
        const form = await request(fixture, cookie, path)
        assert.equal(form.status, 403, await form.clone().text())
        assert.isFalse(filled)
        const run = await request(fixture, cookie, path, {})
        assert.equal(run.status, 403, await run.clone().text())
        assert.isFalse(executed)
      }
    } finally {
      await closeTestApp(fixture)
    }
  })

  for (const ownership of ['tenant_id', 'tenantId']) {
    test(`global relations skip ownership while owned models keep adapter mapping (${ownership})`, async ({
      assert,
    }) => {
      const scopedModels: string[] = []
      const filledModels: string[] = []
      const adapter: TenancyAdapter = {
        async resolve() {
          return { id: 1, name: 'Acme', slug: 'acme' }
        },
        scope(query, tenant, options) {
          scopedModels.push(options.model.table)
          assert.equal(options.ownership, ownership)
          query.where(options.ownership, tenant.id)
        },
        fill(data, tenant, options) {
          filledModels.push(options.model.table)
          assert.equal(options.ownership, ownership)
          const property =
            options.model.$keys.columnsToAttributes.get(options.ownership) ?? options.ownership
          return { ...data, [property]: tenant.id }
        },
        async listForUser() {
          return [{ id: 1, name: 'Acme', slug: 'acme' }]
        },
      }
      const revisions = defineRelationManager(RelationPost, 'revisions')
        .table((t) => t.columns([table.text('title')]))
        .form((s) => [s.text('title').required(), s.text('body').required()])
        .actions({ header: [actions.create()], row: [], bulk: [] })
      const tags = defineRelationManager(RelationPost, 'tags')
        .recordTitle('name')
        .table((t) => t.columns([table.text('name')]))
        .form((s) => [s.text('name').required()])
        .actions({ header: [actions.attach(), actions.create()], row: [], bulk: [] })
      const posts = defineResource(RelationPost)
        .slug('posts')
        .relations([revisions, tags])
        .pages(resourcePages)
      const panel = definePanel('admin')
        .path('/admin')
        .guard('web')
        .middleware([testSessionAuthentication])
        .tenancy({ mode: 'url', ownership, adapter })
        .resources({ posts })
      const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
      try {
        const user = await User.create({
          name: 'Tenant actor',
          email: `global-relations-${Math.random()}@example.test`,
        })
        const cookie = await fixture.loginAs(user)
        const parent = await RelationPost.create({ title: 'Tenant parent', tenantId: 1 })
        const base = `/admin/acme/posts/${parent.id}/relations`
        const created = await request(fixture, cookie, `${base}/revisions/actions/create`, {
          title: 'Global revision',
          body: 'Global body',
        })
        assert.equal(created.status, 200, await created.clone().text())
        const revision = await RelationRevision.query().where('postId', parent.id).firstOrFail()
        assert.equal(revision.title, 'Global revision')
        const list = await request(fixture, cookie, `${base}/revisions`)
        assert.equal(list.status, 200, await list.clone().text())
        assert.include(await list.text(), 'Global revision')
        assert.notInclude(scopedModels, 'relation_revisions')
        assert.notInclude(filledModels, 'relation_revisions')
        const local = await RelationTag.create({ name: `Local-${parent.id}`, tenantId: 1 })
        const foreign = await RelationTag.create({ name: `Foreign-${parent.id}`, tenantId: 2 })
        const options = await request(
          fixture,
          cookie,
          `${base}/tags/actions/attach/options?q=${parent.id}`
        )
        assert.equal(options.status, 200, await options.clone().text())
        const result = (await options.json()) as { options: { value: number }[] }
        assert.include(
          result.options.map((item) => item.value),
          local.id
        )
        assert.notInclude(
          result.options.map((item) => item.value),
          foreign.id
        )
        const denied = await request(fixture, cookie, `${base}/tags/actions/attach`, {
          ids: [foreign.id],
        })
        assert.equal(denied.status, 404)
        const owned = await request(fixture, cookie, `${base}/tags/actions/create`, {
          name: `Owned-${parent.id}`,
        })
        assert.equal(owned.status, 200, await owned.clone().text())
        const tag = await RelationTag.findByOrFail('name', `Owned-${parent.id}`)
        assert.equal(tag.tenantId, 1)
        assert.include(scopedModels, 'relation_tags')
        assert.include(filledModels, 'relation_tags')
      } finally {
        await closeTestApp(fixture)
      }
    })
  }
})
