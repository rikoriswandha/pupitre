import { test } from '@japa/runner'
import {
  definePanel,
  defineRelationManager,
  defineResource,
  pages,
  schema,
  table,
} from '../../../index.js'
import RelationPost from '../../fixtures/models/relation_post.js'
import RelationRevision from '../../fixtures/models/relation_revision.js'
import { closeTestApp, createTestApp, testSessionAuthentication, User } from '../../helpers/app.js'

const revisions = defineResource(RelationRevision)
  .slug('revisions')
  .label('Revision')
  .pluralLabel('Revisions')
  .parent(RelationPost, 'post')
  .recordTitle('title')
  .globallySearchable(['title'])
  .form((s) => [s.text('title').required()])
  .table((t) => t.columns([table.text('title')]))
  .pages({ list: pages.list(), edit: pages.edit() })

const revisionManager = defineRelationManager(RelationPost, 'revisions')
  .label('Revisions')
  .recordTitle('title')
  .table((t) => t.columns([table.text('title')]))

const posts = defineResource(RelationPost)
  .slug('relation-posts')
  .recordTitle('title')
  .form((s) => [
    s.text('title').required(),
    schema.select('revisionIds').relationship('revisions', 'title'),
  ])
  .table((t) => t.columns([table.text('title')]))
  .relations([revisionManager])
  .nested([revisions])
  .pages({ list: pages.list(), edit: pages.edit() })

const panel = definePanel('admin')
  .path('/admin')
  .guard('web')
  .middleware([testSessionAuthentication])
  .resources({ posts })

test.group('nested resource used by a parent relation manager', () => {
  test('relation list applies the nested scope without a :parentId route param', async ({
    assert,
  }) => {
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const user = await User.create({
        name: 'Nested Relations',
        fullName: 'Nested Relations',
        email: 'nested-relations@example.test',
        password: 'password',
      })
      const cookie = await fixture.loginAs(user)
      const first = await RelationPost.create({ title: 'First parent', tenantId: 1 })
      const second = await RelationPost.create({ title: 'Second parent', tenantId: 1 })
      await RelationRevision.create({ postId: first.id, title: 'Own revision', body: 'a' })
      await RelationRevision.create({ postId: second.id, title: 'Foreign revision', body: 'b' })

      const response = await fetch(
        `${fixture.baseUrl}/admin/relation-posts/${first.id}/relations/revisions`,
        { headers: { Accept: 'application/json', Cookie: cookie } }
      )
      const body = await response.text()
      assert.equal(response.status, 200, body)
      assert.include(body, 'Own revision')
      assert.notInclude(body, 'Foreign revision')

      // The nested route still constrains by its :parentId segment.
      const nested = await fetch(`${fixture.baseUrl}/admin/relation-posts/${second.id}/revisions`, {
        headers: {
          'Accept': 'text/html',
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
          'Cookie': cookie,
        },
      })
      const nestedBody = await nested.text()
      assert.equal(nested.status, 200, nestedBody)
      assert.include(nestedBody, 'Foreign revision')
      assert.notInclude(nestedBody, 'Own revision')

      const search = await fetch(`${fixture.baseUrl}/admin/_pupitre/search?q=revision`, {
        headers: { Accept: 'application/json', Cookie: cookie },
      })
      assert.equal(search.status, 200, await search.clone().text())
      const searchBody = (await search.json()) as { groups: unknown[] }
      assert.deepEqual(searchBody.groups, [])

      const options = await fetch(
        `${fixture.baseUrl}/admin/_pupitre/options/relation-posts/revisionIds`,
        { headers: { Accept: 'application/json', Cookie: cookie } }
      )
      assert.equal(options.status, 200, await options.clone().text())
      const optionsBody = (await options.json()) as { options: unknown[] }
      assert.deepEqual(optionsBody.options, [])
    } finally {
      await closeTestApp(fixture)
    }
  })
})
