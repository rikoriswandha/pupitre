import { test } from '@japa/runner'
import { table } from '../../../index.js'
import {
  closeTestApp,
  createTestApp,
  fixturePanel,
  fixturePostResource,
  Post,
  User,
} from '../../helpers/app.js'
import { teardown } from '../../helpers/db.js'

class DenyingReorderPolicy {
  viewAny() {
    return true
  }
  update() {
    return true
  }
  reorder() {
    return false
  }
}

test.group('confirm explicit reorder denial', (group) => {
  group.teardown(async () => {
    await teardown()
  })
  test('does not override reorder false with update true', async ({ assert }) => {
    const posts = fixturePostResource
      .policy(DenyingReorderPolicy)
      .table((t) => t.columns([table.text('title')]).reorderable('viewsCount'))
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: fixturePanel.resources({ posts }) }) },
    })
    try {
      const user = await User.create({
        name: 'Reorder actor',
        email: `reorder-${Math.random()}@test.dev`,
      })
      const cookie = await fixture.loginAs(user)
      const post = await Post.create({
        title: 'Locked order',
        slug: `locked-${Math.random()}`,
        status: 'draft',
        tenantId: 1,
        viewsCount: 42,
      })
      const response = await fetch(`${fixture.baseUrl}/admin/posts/reorder`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cookie': cookie,
          'Connection': 'close',
        },
        body: JSON.stringify({ ids: [post.id] }),
      })
      assert.equal(response.status, 403, await response.clone().text())
      await post.refresh()
      assert.equal(post.viewsCount, 42)
    } finally {
      await closeTestApp(fixture)
    }
  })
})
