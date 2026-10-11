import { test } from '@japa/runner'
import { action, definePanel, defineResource, pages, table } from '../../../index.js'
import type { JobsAdapter } from '../../../src/adapters/jobs.js'
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

test.group('Queued nested bulk parent authorization', () => {
  test('rechecks parent view and update after enqueue and executes only with access restored', async ({
    assert,
  }) => {
    const queued: Record<string, unknown>[] = []
    const handlers = new Map<string, (payload: Record<string, unknown>) => Promise<void>>()
    const jobs: JobsAdapter = {
      register(name, handler) {
        handlers.set(name, handler)
      },
      async dispatch(_name, payload) {
        queued.push(payload)
      },
    }
    let executed = 0
    const revise = action('revise-selected')
      .async()
      .handle(async ({ records }) => {
        executed++
        for (const record of records ?? []) {
          await (record as RelationComment).merge({ body: 'Revised by worker' }).save()
        }
      })
    const comments = defineResource(RelationComment)
      .slug('comments')
      .parent(RelationPost, 'post')
      .table((t) => t.columns([table.text('title')]))
      .actions({ header: [], row: [], bulk: [revise] })
      .pages({ list: pages.list() })
    const posts = defineResource(RelationPost)
      .slug('relation-posts')
      .policy(ParentPolicy)
      .nested([comments])
      .pages({ list: pages.list(), view: pages.view() })
    const panel = definePanel('admin')
      .path('/admin')
      .guard('web')
      .middleware([testSessionAuthentication])
      .resources({ posts })
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { jobs },
    })
    try {
      parentViewAllowed = true
      parentUpdateAllowed = true
      const user = await User.create({
        name: 'Nested bulk actor',
        email: `nested-bulk-${Math.random()}@example.test`,
      })
      const cookie = await fixture.loginAs(user)
      const parent = await RelationPost.create({ title: 'Nested bulk parent', tenantId: 1 })
      const child = await RelationComment.create({
        postId: parent.id,
        tenantId: 1,
        title: 'Child',
        body: 'Original body',
      })
      const response = await fetch(
        `${fixture.baseUrl}/admin/relation-posts/${parent.id}/comments/actions/revise-selected`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Pupitre-Action': '1',
            'Cookie': cookie,
            'Connection': 'close',
          },
          body: JSON.stringify({ ids: [child.id] }),
        }
      )
      assert.equal(response.status, 200, await response.clone().text())
      assert.lengthOf(queued, 1)
      const handler = handlers.get('pupitre.bulk')
      if (!handler) throw new Error('Bulk worker was not registered')
      const payload = JSON.parse(JSON.stringify(queued[0])) as Record<string, unknown>
      parentUpdateAllowed = false
      await assert.rejects(() => handler(payload))
      await child.refresh()
      assert.equal(child.body, 'Original body')
      assert.equal(executed, 0)
      parentUpdateAllowed = true
      parentViewAllowed = false
      await assert.rejects(() => handler(payload))
      await child.refresh()
      assert.equal(child.body, 'Original body')
      assert.equal(executed, 0)
      parentViewAllowed = true
      await handler(payload)
      await child.refresh()
      assert.equal(child.body, 'Revised by worker')
      assert.equal(executed, 1)
    } finally {
      parentViewAllowed = true
      parentUpdateAllowed = true
      await closeTestApp(fixture)
    }
  })
})
