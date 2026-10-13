import { test } from '@japa/runner'
import { definePanel, defineResource, pages } from '@rikology/pupitre'
import { kanban } from '../index.js'
import {
  createTestApp,
  closeTestApp,
  PostPolicy,
  denyPolicyAbility,
  allowPolicyAbilities,
} from '../../pupitre/tests/helpers/app.js'
import { teardown, truncate } from '../../pupitre/tests/helpers/db.js'
import Post from '../../pupitre/tests/fixtures/models/post.js'

const resource = defineResource(Post)
  .slug('posts')
  .policy(PostPolicy)
  .scope((query) => query.where('tenant_id', 1))
  .form((s) => [
    s.wizard([
      s
        .step('Details')
        .components([
          s.select('status').options({ draft: 'Draft', published: 'Published' }).default('draft'),
        ]),
    ]),
  ])
  .pages({ list: pages.list(), edit: pages.edit(), view: pages.view(), create: pages.create() })
const options = {
  statusColumn: 'status',
  statuses: [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
  ],
  title: 'title',
  orderColumn: 'viewsCount',
  limitPerColumn: 1,
  page: { slug: 'board', label: 'Board' },
}
const board = kanban(resource, options)
const widgetUrl = '/admin/_pupitre/widgets/kanban-board?customPage=board'

async function fixture(plugin = board, target = resource) {
  const app = await createTestApp({
    panels: {
      admin: async () => ({
        default: definePanel('admin').resources([target]).plugins([plugin]),
      }),
    },
  })
  await truncate()
  const records = await Post.createMany([
    { title: 'First', slug: 'first', status: 'draft', tenantId: 1, viewsCount: 0 },
    { title: 'Second', slug: 'second', status: 'draft', tenantId: 1, viewsCount: 1 },
    { title: 'Published', slug: 'published', status: 'published', tenantId: 1, viewsCount: 0 },
    { title: 'Other tenant', slug: 'other', status: 'draft', tenantId: 2, viewsCount: 0 },
  ])
  return { app, records }
}
async function move(baseUrl: string, id: number, status: string, position = 0) {
  return fetch(`${baseUrl}/admin/_pupitre/widgets/kanban-board/actions/move?customPage=board`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Pupitre-Action': '1',
    },
    body: JSON.stringify({ data: { id: String(id), status, position } }),
  })
}

test.group('kanban scoped loading and transactional moves', (suite) => {
  suite.teardown(teardown)
  suite.each.teardown(() => allowPolicyAbilities())
  test('create status prefill accepts only declared statuses and creation remains authorized', async ({
    assert,
  }) => {
    const { app } = await fixture()
    try {
      const response = await fetch(app.baseUrl + '/admin/posts/create?kanbanStatus=published', {
        headers: { 'X-Inertia': 'true' },
      })
      const page = (await response.json()) as {
        props: { page: { state: { data: { status: string } } } }
      }
      assert.equal(page.props.page.state.data.status, 'published')
      const invalid = await fetch(app.baseUrl + '/admin/posts/create?kanbanStatus=missing', {
        headers: { 'X-Inertia': 'true' },
      })
      const invalidPage = (await invalid.json()) as typeof page
      assert.equal(invalidPage.props.page.state.data.status, 'draft')
      denyPolicyAbility('create')
      const loaded = await fetch(app.baseUrl + widgetUrl)
      const boardData = (await loaded.json()) as { data: { createUrl?: string } }
      assert.isUndefined(boardData.data.createUrl)
      const forbidden = await fetch(app.baseUrl + '/admin/posts/create?kanbanStatus=published', {
        headers: { Accept: 'application/json' },
      })
      assert.equal(forbidden.status, 403)
    } finally {
      await closeTestApp(app)
    }
  }).timeout(30000)
  test('loads independent status limits, counts, authorized links and larger columns', async ({
    assert,
  }) => {
    const { app } = await fixture()
    try {
      const response = await fetch(app.baseUrl + widgetUrl)
      assert.equal(response.status, 200)
      const payload = (await response.json()) as {
        data: { columns: { count: number; cards: { title: string; url?: string }[] }[] }
      }
      assert.deepEqual(
        payload.data.columns.map((column) => column.count),
        [2, 1]
      )
      assert.deepEqual(
        payload.data.columns[0].cards.map((card) => card.title),
        ['First']
      )
      denyPolicyAbility('view')
      denyPolicyAbility('update')
      const expanded = await fetch(app.baseUrl + widgetUrl + '&kanbanLimit_draft=2')
      const loaded = (await expanded.json()) as typeof payload
      assert.lengthOf(loaded.data.columns[0].cards, 2)
      assert.isUndefined(loaded.data.columns[0].cards[0].url)
      denyPolicyAbility('viewAny')
      const deniedLoad = await fetch(app.baseUrl + widgetUrl, {
        headers: { Accept: 'application/json' },
      })
      assert.equal(deniedLoad.status, 403)
    } finally {
      await closeTestApp(app)
    }
  }).timeout(30000)
  test('rejects update denial, foreign tenant, undeclared status and business rule', async ({
    assert,
  }) => {
    const { app, records } = await fixture(
      board.canMove((_record, _from, to) => to !== 'published')
    )
    try {
      denyPolicyAbility('update')
      const deniedMove = await move(app.baseUrl, records[0].id, 'draft')
      assert.equal(deniedMove.status, 403)
      allowPolicyAbilities()
      const foreignMove = await move(app.baseUrl, records[3].id, 'draft')
      const invalidMove = await move(app.baseUrl, records[0].id, 'missing')
      const ruleMove = await move(app.baseUrl, records[0].id, 'published')
      assert.equal(foreignMove.status, 404)
      assert.equal(invalidMove.status, 422)
      assert.equal(ruleMove.status, 403)
      await records[0].refresh()
      assert.equal(records[0].status, 'draft')
    } finally {
      await closeTestApp(app)
    }
  }).timeout(30000)
  test('denies sibling reordering before any row is persisted', async ({ assert }) => {
    class SiblingPolicy extends PostPolicy {
      update(_user: unknown, record: Post) {
        return record.title !== 'Second' && record.title !== 'Published'
      }
    }
    const target = resource.policy(SiblingPolicy)
    const { app, records } = await fixture(kanban(target, options), target)
    try {
      for (const status of ['draft', 'published']) {
        const response = await move(app.baseUrl, records[0].id, status, status === 'draft' ? 1 : 0)
        assert.equal(response.status, 403, await response.text())
        for (const record of records) await record.refresh()
        assert.deepEqual(
          records.map((record) => [record.status, record.viewsCount]),
          [
            ['draft', 0],
            ['draft', 1],
            ['published', 0],
            ['draft', 0],
          ]
        )
      }
    } finally {
      await closeTestApp(app)
    }
  }).timeout(30000)
  test('persists destination insertion and compacts source without touching other tenants', async ({
    assert,
  }) => {
    const { app, records } = await fixture()
    try {
      const response = await move(app.baseUrl, records[0].id, 'published', 0)
      assert.equal(response.status, 200)
      for (const record of records) await record.refresh()
      assert.deepEqual(
        records.map((record) => [record.status, record.viewsCount]),
        [
          ['published', 0],
          ['draft', 0],
          ['published', 1],
          ['draft', 0],
        ]
      )
      const reordered = await move(app.baseUrl, records[2].id, 'published', 0)
      assert.equal(reordered.status, 200)
      await records[0].refresh()
      await records[2].refresh()
      assert.equal(records[0].viewsCount, 1)
      assert.equal(records[2].viewsCount, 0)
    } finally {
      await closeTestApp(app)
    }
  }).timeout(30000)
})
