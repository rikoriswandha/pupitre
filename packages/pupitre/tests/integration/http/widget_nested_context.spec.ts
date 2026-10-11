import { test } from '@japa/runner'
import { definePanel, defineResource, defineWidget, pages, stat, table } from '../../../index.js'
import { pageProps, widgetData } from '../../../catalog/wire.js'
import RelationComment from '../../fixtures/models/relation_comment.js'
import RelationPost from '../../fixtures/models/relation_post.js'
import { closeTestApp, createTestApp, testSessionAuthentication, User } from '../../helpers/app.js'

let parentViewAllowed = true
let parentUpdateAllowed = true
class ParentPolicy {
  viewAny() {
    return true
  }
  view() {
    return parentViewAllowed
  }
  update() {
    return parentUpdateAllowed
  }
}

const summary = defineWidget('nested-summary')
  .stats(({ ctx, record }) => [
    stat('Parent', String(ctx.params.parentId)),
    stat('Child', (record as RelationComment | undefined)?.title ?? 'no record'),
  ])
  .poll('1s')
  .lazy(false)
const comments = defineResource(RelationComment)
  .slug('comments')
  .parent(RelationPost, 'post')
  .form((schema) => [schema.text('title').required(), schema.textarea('body').required()])
  .table((definition) => definition.columns([table.text('title')]))
  .pages({
    list: pages.list().widgets([summary]),
    create: pages.create().widgets([summary]),
    edit: pages.edit().widgets([summary]),
    view: pages.view().widgets([summary]),
  })
const posts = defineResource(RelationPost)
  .slug('relation-posts')
  .policy(ParentPolicy)
  .nested([comments])
  .form((schema) => [schema.text('title').required()])
  .table((definition) => definition.columns([table.text('title')]))
  .pages({ list: pages.list(), create: pages.create(), edit: pages.edit(), view: pages.view() })
const panel = definePanel('admin')
  .path('/admin')
  .guard('web')
  .middleware([testSessionAuthentication])
  .resources({ posts })

test.group('nested widget polling context', () => {
  test('binds parent URLs, scopes records, and rechecks parent view/create access', async ({
    assert,
  }) => {
    parentViewAllowed = true
    parentUpdateAllowed = true
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const user = await User.create({
        name: 'Widget reader',
        email: `widget-${Math.random()}@test.dev`,
      })
      const cookie = await fixture.loginAs(user)
      const parent = await RelationPost.create({ title: 'Parent', tenantId: 1 })
      const other = await RelationPost.create({ title: 'Other parent', tenantId: 1 })
      const child = await RelationComment.create({
        title: 'Scoped child',
        body: 'Body',
        postId: parent.id,
        tenantId: 1,
      })
      const headers = { Accept: 'application/json', Cookie: cookie, Connection: 'close' }
      const urls: Record<string, string> = {}
      for (const [kind, suffix] of Object.entries({
        list: '',
        create: '/create',
        view: `/${child.id}`,
        edit: `/${child.id}/edit`,
      })) {
        const initial = await fetch(
          `${fixture.baseUrl}/admin/relation-posts/${parent.id}/comments${suffix}`,
          {
            headers: {
              ...headers,
              'Accept': 'text/html',
              'X-Inertia': 'true',
              'X-Inertia-Version': '1',
            },
          }
        )
        const body = (await initial.json()) as { props: unknown }
        assert.equal(initial.status, 200)
        const descriptor = pageProps.parse(body.props).page.widgets![0]!
        const url = descriptor.dataUrl!
        urls[kind] = url
        const params = new URL(url, fixture.baseUrl).searchParams
        assert.equal(params.get('parentId'), String(parent.id))
        assert.equal(params.get('widgetPage'), kind)
        const refreshed = await fetch(`${fixture.baseUrl}${url}&page=2`, { headers })
        const data = await refreshed.json()
        assert.equal(refreshed.status, 200, JSON.stringify(data))
        assert.include(JSON.stringify(widgetData.parse(data)), String(parent.id))
        if (kind === 'edit' || kind === 'view') assert.include(JSON.stringify(data), child.title)
      }
      const wrongParent = urls.view!.replace(`parentId=${parent.id}`, `parentId=${other.id}`)
      const scoped = await fetch(`${fixture.baseUrl}${wrongParent}`, { headers })
      assert.equal(scoped.status, 404)
      const missingParent = urls.list!.replace(`&parentId=${parent.id}`, '')
      const missing = await fetch(`${fixture.baseUrl}${missingParent}`, { headers })
      assert.equal(missing.status, 404)
      parentViewAllowed = false
      for (const url of Object.values(urls)) {
        const denied = await fetch(`${fixture.baseUrl}${url}`, { headers })
        assert.equal(denied.status, 403)
      }
      parentViewAllowed = true
      parentUpdateAllowed = false
      const deniedCreate = await fetch(`${fixture.baseUrl}${urls.create}`, { headers })
      assert.equal(deniedCreate.status, 403)
      const deniedEdit = await fetch(`${fixture.baseUrl}${urls.edit}`, { headers })
      assert.equal(deniedEdit.status, 403)
      const allowedList = await fetch(`${fixture.baseUrl}${urls.list}`, { headers })
      assert.equal(allowedList.status, 200)
    } finally {
      parentViewAllowed = true
      parentUpdateAllowed = true
      await closeTestApp(fixture)
    }
  })
})
