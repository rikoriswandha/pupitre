import { test } from '@japa/runner'
import { column } from '@adonisjs/lucid/orm'
import { definePanel, defineResource, pages, qb, table } from '../../../index.js'
import {
  closeTestApp,
  createTestApp,
  testSessionAuthentication,
  User,
  Post,
  PostPolicy,
} from '../../helpers/app.js'

class QueryProduct extends Post {
  static table = 'posts'
  @column({ columnName: 'views_count' }) declare price: number
}
const resource = defineResource(QueryProduct)
  .slug('query-products')
  .policy(PostPolicy)
  .table((builder) =>
    builder
      .columns([table.text('title').sortable(), table.text('price').sortable()])
      .multiSort(3)
      .filters([
        table.filter
          .queryBuilder()
          .constraints([
            qb.text('title'),
            qb.number('price').integer(),
            qb.date('publishedAt').timezone('Asia/Jakarta'),
          ]),
      ])
  )
  .pages({ list: pages.list() })
const panel = definePanel('admin')
  .path('/admin')
  .guard('web')
  .middleware([testSessionAuthentication])
  .resources({ products: resource })

test('hand-written comma URLs return sorted filtered rows and invalid integer/date queries return HTTP 400', async ({
  assert,
}) => {
  const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
  try {
    const user = await User.create({
      name: 'Query admin',
      email: 'query-http@example.test',
      password: 'password',
    })
    const cookie = await fixture.loginAs(user)
    await Post.createMany([
      { title: 'Same', slug: 'low', status: 'draft', viewsCount: 10 },
      { title: 'Same', slug: 'high', status: 'draft', viewsCount: 20 },
      { title: 'Other', slug: 'other', status: 'draft', viewsCount: 30 },
    ])
    const visit = (suffix: string) =>
      fetch(`${fixture.baseUrl}/admin/query-products?${suffix}`, {
        headers: {
          'Cookie': cookie,
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
          'Accept': 'application/json',
        },
      })
    const response = await visit(
      'sort=title,-price&filters[query]={"groups":[[{"constraint":"title","operator":"equals","value":"Same"},{"constraint":"price","operator":"greaterThan","value":0}]]}'
    )
    assert.equal(response.status, 200, await response.clone().text())
    const body = (await response.json()) as {
      props: { data: { rows: { cells: { price: unknown } }[] } }
    }
    assert.deepEqual(
      body.props.data.rows.map((row) => row.cells.price),
      [20, 10]
    )
    for (const value of [1.5, 3000000000, 1e21]) {
      const invalid = await visit(
        `filters[query]=${encodeURIComponent(JSON.stringify({ groups: [[{ constraint: 'price', operator: 'equals', value }]] }))}`
      )
      assert.equal(invalid.status, 400, await invalid.clone().text())
    }
    for (const value of ['0000-01-01', '0001-01-01']) {
      const invalid = await visit(
        `filters[query]=${encodeURIComponent(JSON.stringify({ groups: [[{ constraint: 'publishedAt', operator: 'on', value }]] }))}`
      )
      assert.equal(invalid.status, 400, await invalid.clone().text())
    }
  } finally {
    await closeTestApp(fixture)
  }
})
