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
import { closeTestApp, createTestApp, testSessionAuthentication, User } from '../../helpers/app.js'
import type { TestApplication } from '../../helpers/app.js'
import RelationPost from '../../fixtures/models/relation_post.js'
import RelationTag from '../../fixtures/models/relation_tag.js'

let deniedViewId: number | undefined
let deniedPublishId: number | undefined
let hidden = false
let attachAllowed = true
class TagPolicy {
  viewAny() {
    return true
  }
  view(_user: unknown, record: RelationTag) {
    return record.id !== deniedViewId
  }
  publish(_user: unknown, record: RelationTag) {
    return record.id !== deniedPublishId
  }
  create() {
    return true
  }
  attach() {
    return attachAllowed
  }
}
class MissingViewPolicy {
  viewAny() {
    return true
  }
  create() {
    return true
  }
}

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

test.group('Relation action server guards', () => {
  test('bulk selections stay scoped and require view/can on every record; hidden forms and handlers are denied', async ({
    assert,
  }) => {
    const handled: number[][] = []
    let filled = 0
    const bulk = actions
      .bulk('publish-tags')
      .can('publish')
      .handle(({ records }) => {
        handled.push((records ?? []).map((record) => (record as RelationTag).id))
      })
    const inspect = action('inspect')
      .visible(() => !hidden)
      .form([schema.text('name')])
      .fillForm(() => {
        filled++
        return {}
      })
      .handle(({ record }) => {
        handled.push([(record as RelationTag).id])
      })
    const tags = defineRelationManager(RelationPost, 'tags')
      .table((t) => t.columns([table.text('name')]))
      .actions({ header: [actions.attach()], row: [inspect], bulk: [bulk] })
    const posts = defineResource(RelationPost)
      .slug('posts')
      .relations([tags])
      .pages({ list: pages.list(), view: pages.view() })
    const tagResource = defineResource(RelationTag)
      .slug('tags')
      .policy(TagPolicy)
      .scope((query) => {
        query.where('tenantId', 1)
      })
      .pages({ list: pages.list() })
    const panel = definePanel('admin')
      .path('/admin')
      .guard('web')
      .middleware([testSessionAuthentication])
      .resources({ posts, tags: tagResource })
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const user = await User.create({
        name: 'Bulk relation actor',
        email: `bulk-relation-${Math.random()}@example.test`,
      })
      const cookie = await fixture.loginAs(user)
      const parent = await RelationPost.create({ title: 'Parent', tenantId: 1 })
      const first = await RelationTag.create({ name: 'First', tenantId: 1 })
      const second = await RelationTag.create({ name: 'Second', tenantId: 1 })
      const unattached = await RelationTag.create({ name: 'Unattached', tenantId: 1 })
      const foreign = await RelationTag.create({ name: 'Foreign', tenantId: 2 })
      await parent.related('tags').attach([first.id, second.id, foreign.id])
      const base = `/admin/posts/${parent.id}/relations/tags`
      for (const invalid of [unattached.id, foreign.id]) {
        const response = await request(fixture, cookie, `${base}/actions/publish-tags`, {
          ids: [first.id, invalid],
        })
        assert.equal(response.status, 404, await response.clone().text())
      }
      deniedViewId = second.id
      const deniedView = await request(fixture, cookie, `${base}/actions/publish-tags`, {
        ids: [first.id, second.id],
      })
      assert.equal(deniedView.status, 403)
      deniedViewId = undefined
      deniedPublishId = second.id
      const deniedPublish = await request(fixture, cookie, `${base}/actions/publish-tags`, {
        ids: [first.id, second.id],
      })
      assert.equal(deniedPublish.status, 403)
      assert.deepEqual(handled, [])
      deniedPublishId = undefined
      const allowed = await request(fixture, cookie, `${base}/actions/publish-tags`, {
        ids: [first.id, second.id],
      })
      assert.equal(allowed.status, 200, await allowed.clone().text())
      assert.deepEqual(
        handled[0]?.sort((a, b) => a - b),
        [first.id, second.id]
      )
      hidden = true
      const form = await request(fixture, cookie, `${base}/${first.id}/actions/inspect`)
      assert.equal(form.status, 403)
      assert.equal(filled, 0)
      const run = await request(fixture, cookie, `${base}/${first.id}/actions/inspect`, {})
      assert.equal(run.status, 403)
      assert.lengthOf(handled, 1)
      attachAllowed = false
      const deniedAttach = await request(fixture, cookie, `${base}/actions/attach`, {
        ids: [unattached.id],
      })
      assert.equal(deniedAttach.status, 403)
      assert.lengthOf(await parent.related('tags').query().where('id', unattached.id), 0)
    } finally {
      deniedViewId = undefined
      deniedPublishId = undefined
      hidden = false
      attachAllowed = true
      await closeTestApp(fixture)
    }
  })

  for (const registered of [true, false]) {
    test(`missing view denies custom record actions and missing attach falls back to create (${registered ? 'resource' : 'model'} policy)`, async ({
      assert,
    }) => {
      let filled = false
      let executed = false
      const inspect = action('inspect')
        .form([schema.text('name')])
        .fillForm(() => {
          filled = true
          return {}
        })
        .handle(() => {
          executed = true
        })
      const tags = defineRelationManager(RelationPost, 'tags')
        .table((t) => t.columns([table.text('name')]))
        .actions({ header: [actions.attach()], row: [inspect], bulk: [] })
      const posts = defineResource(RelationPost)
        .slug('posts')
        .relations([tags])
        .pages({ list: pages.list(), view: pages.view() })
      const tagResource = defineResource(RelationTag)
        .slug('tags')
        .policy(MissingViewPolicy)
        .pages({ list: pages.list() })
      const panel = definePanel('admin')
        .path('/admin')
        .guard('web')
        .middleware([testSessionAuthentication])
        .resources(registered ? { posts, tags: tagResource } : { posts })
      const fixture = await createTestApp({
        panels: { admin: async () => ({ default: panel }) },
        ...(!registered
          ? { pupitre: { policies: async () => ({ RelationTagPolicy: MissingViewPolicy }) } }
          : {}),
      })
      try {
        const user = await User.create({
          name: 'Missing policy actor',
          email: `missing-view-${Math.random()}@example.test`,
        })
        const cookie = await fixture.loginAs(user)
        const parent = await RelationPost.create({ title: 'Parent', tenantId: 1 })
        const tag = await RelationTag.create({ name: 'Policy target', tenantId: 1 })
        const base = `/admin/posts/${parent.id}/relations/tags`
        const attached = await request(fixture, cookie, `${base}/actions/attach`, { ids: [tag.id] })
        assert.equal(attached.status, 200, await attached.clone().text())
        assert.lengthOf(await parent.related('tags').query().where('id', tag.id), 1)
        const form = await request(fixture, cookie, `${base}/${tag.id}/actions/inspect`)
        assert.equal(form.status, 403, await form.clone().text())
        const run = await request(fixture, cookie, `${base}/${tag.id}/actions/inspect`, {})
        assert.equal(run.status, 403, await run.clone().text())
        assert.isFalse(filled)
        assert.isFalse(executed)
      } finally {
        await closeTestApp(fixture)
      }
    })
  }
})
