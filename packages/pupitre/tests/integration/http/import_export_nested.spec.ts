import { test } from '@japa/runner'
import { actions, definePanel, defineResource, pages, table } from '../../../index.js'
import RelationComment from '../../fixtures/models/relation_comment.js'
import RelationPost from '../../fixtures/models/relation_post.js'
import { closeTestApp, createTestApp, testSessionAuthentication, User } from '../../helpers/app.js'
import type { TestApplication } from '../../helpers/app.js'
import { teardown } from '../../helpers/db.js'

let parentViewAllowed = true
let parentUpdateAllowed = true

class NestedParentPolicy {
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

const comments = defineResource(RelationComment)
  .slug('comments')
  .parent(RelationPost, 'post')
  .form((schema) => [schema.text('title').required(), schema.textarea('body').required()])
  .table((definition) => definition.columns([table.text('title')]))
  .actions({ header: [actions.export(), actions.import()], row: [], bulk: [] })
  .pages({ list: pages.list(), create: pages.create(), edit: pages.edit(), view: pages.view() })
const posts = defineResource(RelationPost)
  .slug('relation-posts')
  .policy(NestedParentPolicy)
  .nested([comments])
  .form((schema) => [schema.text('title').required()])
  .table((definition) => definition.columns([table.text('title')]))
  .pages({ list: pages.list(), create: pages.create(), edit: pages.edit(), view: pages.view() })
const panel = definePanel('admin')
  .path('/admin')
  .guard('web')
  .middleware([testSessionAuthentication])
  .resources({ posts })

async function nestedRequest(
  fixture: TestApplication,
  cookie: string,
  parentId: number,
  action: 'export' | 'import',
  body?: FormData
) {
  const url = `${fixture.baseUrl}/admin/relation-posts/${parentId}/comments/${action}?action=${action}`
  const headers = { Accept: 'application/json', Cookie: cookie, Connection: 'close' }
  return body
    ? fetch(url, { method: 'POST', headers, body })
    : fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
}

test.group('Pupitre nested import and export authorization', (group) => {
  let fixture: TestApplication
  group.setup(async () => {
    fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
  })
  group.each.setup(async () => {
    parentViewAllowed = true
    parentUpdateAllowed = true
    await RelationComment.query().delete()
    await RelationPost.query().delete()
  })
  group.teardown(async () => {
    await closeTestApp(fixture)
    await teardown()
  })

  test('authorizes the parent and sets child ownership when importing', async ({ assert }) => {
    const user = await User.create({
      name: 'Nested import owner',
      email: `nested-import-${Math.random()}@example.test`,
    })
    const cookie = await fixture.loginAs(user)
    const parent = await RelationPost.create({ title: 'Parent', tenantId: 1 })
    await RelationComment.create({
      postId: parent.id,
      tenantId: 1,
      title: 'Existing child',
      body: 'Existing body',
    })

    parentViewAllowed = false
    const forbiddenExport = await nestedRequest(fixture, cookie, parent.id, 'export')
    assert.equal(forbiddenExport.status, 403)

    parentViewAllowed = true
    const exportResponse = await nestedRequest(fixture, cookie, parent.id, 'export')
    assert.equal(exportResponse.status, 200, await exportResponse.clone().text())
    assert.include(await exportResponse.text(), 'Existing child')

    parentUpdateAllowed = false
    const importDenied = new FormData()
    importDenied.append('file', new File(['title,body\nDenied,Denied body\n'], 'comments.csv'))
    importDenied.append('mapping', JSON.stringify({ title: 'title', body: 'body' }))
    const deniedImportResponse = await nestedRequest(
      fixture,
      cookie,
      parent.id,
      'import',
      importDenied
    )
    assert.equal(deniedImportResponse.status, 403)
    assert.isNull(await RelationComment.findBy('title', 'Denied'))

    parentUpdateAllowed = true
    const importForm = new FormData()
    importForm.append('file', new File(['title,body\nOwned child,Imported body\n'], 'comments.csv'))
    importForm.append('mapping', JSON.stringify({ title: 'title', body: 'body' }))
    const importResponse = await nestedRequest(fixture, cookie, parent.id, 'import', importForm)
    assert.equal(importResponse.status, 200, await importResponse.clone().text())
    const imported = await RelationComment.findBy('title', 'Owned child')
    assert.isNotNull(imported)
    assert.equal(imported?.postId, parent.id)
  })
})
