import { test } from '@japa/runner'
import { column, computed } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { TableDefinition } from '../../src/definition/table.js'
import { aggregateTableSummaries } from '../../src/table/table_summary.js'
import { buildTableData } from '../../src/table/table_data.js'
import { Post, User, setupDatabase, teardown, truncate } from '../helpers/db.js'

// A serializer can normalize a SQLite numeric boolean without a consume hook.
class SummaryPost extends Post {
  static table = 'posts'

  @column({ serialize: (value: unknown) => Boolean(value) })
  declare isFeatured: boolean

  @computed()
  get titlePreview() {
    return this.title.slice(0, 3)
  }
}

function groupedTable(key: string): TableDefinition {
  return {
    columns: [{ kind: 'text', name: 'viewsCount', numeric: true, summaries: ['sum', 'count'] }],
    filters: [],
    groups: [{ key }],
    filtersLayout: 'dropdown',
    searchDebounce: 300,
    paginated: [10],
    striped: false,
  }
}

test.group('SQL summary serialized group keys', (group) => {
  group.each.setup(async () => {
    await setupDatabase()
    await truncate()
  })
  group.teardown(async () => teardown())

  for (const key of ['publishedAt', 'isFeatured']) {
    test(`${key} summaries match serialized row groups across pagination`, async ({ assert }) => {
      const timestamp = DateTime.fromISO('2026-10-11T09:15:00.000Z', { zone: 'UTC' })
      await SummaryPost.createMany([
        {
          title: 'Included first',
          slug: 'summary-first',
          status: 'draft',
          publishedAt: timestamp,
          isFeatured: true,
          viewsCount: 3,
        },
        {
          title: 'Included second',
          slug: 'summary-second',
          status: 'draft',
          publishedAt: timestamp,
          isFeatured: true,
          viewsCount: 7,
        },
        {
          title: 'Other group',
          slug: 'summary-other',
          status: 'draft',
          publishedAt: null,
          isFeatured: false,
          viewsCount: 20,
        },
        {
          title: 'Excluded',
          slug: 'summary-excluded',
          status: 'published',
          publishedAt: timestamp,
          isFeatured: true,
          viewsCount: 100,
        },
      ])
      const table = groupedTable(key)
      const normalized = { groupBy: key }
      const options = { locale: 'en', timezone: 'UTC', normalized }
      const query = SummaryPost.query().where('status', 'draft').orderBy('id')
      const summaries = await aggregateTableSummaries(query, table, options)
      const pageRows = await query.clone().limit(1)
      const data = await buildTableData(
        table,
        pageRows,
        {},
        {
          ...options,
          groupSummaries: summaries.groups,
          rowActions: async () => [],
          rowUrl: () => undefined,
        }
      )
      const expectedKey = String(pageRows[0]!.serialize()[key])
      assert.equal(data.groups?.[0]?.key, expectedKey)
      assert.deepEqual(summaries.groups?.[expectedKey]?.viewsCount, { sum: '10', count: '2' })
      // If the SQL key misses, buildTableData falls back to the page-only sum of 3.
      assert.deepEqual(data.groups?.[0]?.summary?.viewsCount, { sum: '10', count: '2' })
      assert.deepEqual(summaries.groups?.[key === 'publishedAt' ? '' : 'false']?.viewsCount, {
        sum: '20',
        count: '1',
      })
      assert.lengthOf(Object.keys(summaries.groups ?? {}), 2)
    })
  }

  test('merges null and empty-string SQL groups and weights averages by non-null count', async ({
    assert,
  }) => {
    await SummaryPost.createMany([
      { title: 'Null A', slug: 'null-a', body: null, viewsCount: 3 },
      { title: 'Null B', slug: 'null-b', body: null, viewsCount: 5 },
      { title: 'Empty', slug: 'empty', body: '', viewsCount: 7 },
      { title: 'Other', slug: 'other', body: 'other', viewsCount: 20 },
    ])
    const table = groupedTable('body')
    table.columns = [
      {
        kind: 'text',
        name: 'viewsCount',
        numeric: true,
        summaries: ['sum', 'count', 'avg', 'min', 'max', 'range'],
      },
    ]
    const options = { locale: 'en', timezone: 'UTC', normalized: { groupBy: 'body' } }
    const query = SummaryPost.query().orderBy('id')
    const aggregate = await aggregateTableSummaries(query, table, options)
    const rows = await query.clone().limit(1)
    const data = await buildTableData(
      table,
      rows,
      {},
      {
        ...options,
        groupSummaries: aggregate.groups,
        rowActions: async () => [],
        rowUrl: () => undefined,
      }
    )
    assert.lengthOf(Object.keys(aggregate.groups ?? {}), 2)
    assert.deepEqual(data.groups?.[0]?.summary?.viewsCount, {
      sum: '15',
      count: '3',
      avg: '5',
      min: '3',
      max: '7',
      range: '3 – 7',
    })
    assert.deepEqual(aggregate.groups?.other?.viewsCount, {
      sum: '20',
      count: '1',
      avg: '20',
      min: '20',
      max: '20',
      range: '20 – 20',
    })
  })

  test('correlates dotted group and summary fields to each row relation', async ({ assert }) => {
    const [ada, bea] = await User.createMany([
      { name: 'Ada', email: 'ada-summary@example.test' },
      { name: 'Bea', email: 'bea-summary@example.test' },
    ])
    await SummaryPost.createMany([
      { title: 'Ada first', slug: 'ada-first', authorId: ada!.id, viewsCount: 3 },
      { title: 'Ada second', slug: 'ada-second', authorId: ada!.id, viewsCount: 7 },
      { title: 'Bea first', slug: 'bea-first', authorId: bea!.id, viewsCount: 20 },
    ])
    const table = groupedTable('author.name')
    table.columns.push({ kind: 'text', name: 'author.id', numeric: true, summaries: ['sum'] })
    const options = { locale: 'en', timezone: 'UTC', normalized: { groupBy: 'author.name' } }
    const query = SummaryPost.query().orderBy('id')
    const aggregate = await aggregateTableSummaries(query, table, options)
    const rows = await query.clone().preload('author').limit(1)
    const data = await buildTableData(
      table,
      rows,
      {},
      {
        ...options,
        groupSummaries: aggregate.groups,
        rowActions: async () => [],
        rowUrl: () => undefined,
      }
    )
    assert.deepEqual(aggregate.groups?.Ada?.viewsCount, { sum: '10', count: '2' })
    assert.deepEqual(aggregate.groups?.Bea?.viewsCount, { sum: '20', count: '1' })
    assert.deepEqual(aggregate.groups?.Ada?.['author.id'], { sum: String(ada!.id * 2) })
    assert.deepEqual(aggregate.groups?.Bea?.['author.id'], { sum: String(bea!.id) })
    assert.deepEqual(data.groups?.[0]?.summary, aggregate.groups?.Ada)
  })
})
