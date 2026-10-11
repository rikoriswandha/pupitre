import { table as tableBuilder } from '../../index.js'
import { test } from '@japa/runner'
import type { TableDefinition } from '../../src/definition/table.js'
import { applyTableQuery } from '../../src/query/table_query.js'
import { aggregateTableSummaries } from '../../src/table/table_summary.js'
import { buildTableData } from '../../src/table/table_data.js'
import { setupDatabase, teardown, truncate, Post } from '../helpers/db.js'

const table: TableDefinition = {
  columns: [
    { kind: 'text', name: 'title', searchable: true, individuallySearchable: true, sortable: true },
    { kind: 'text', name: 'author.name', individuallySearchable: true },
    {
      kind: 'text',
      name: 'viewsCount',
      numeric: true,
      summaries: ['sum', 'avg', 'count', 'range'],
    },
  ],
  filters: [{ kind: 'trashed', name: 'trashed' }],
  groups: [{ key: 'status', label: 'Status', collapsible: true }],
  defaultGroup: 'status',
  filtersLayout: 'dropdown',
  searchDebounce: 300,
  paginated: [10, 25],
  striped: false,
}

test.group('table data query', (group) => {
  group.each.setup(async () => {
    await setupDatabase()
    await truncate()
  })
  group.teardown(async () => teardown())

  test('parses prefixed group, column search and trashed params into scoped SQL', async ({
    assert,
  }) => {
    const db = await setupDatabase()
    const result = applyTableQuery(
      db.modelQuery(Post) as never,
      table,
      {
        posts: {
          groupBy: 'status',
          columns: { 'author.name': { search: 'Ada' } },
          filters: { trashed: 'only' },
        },
      },
      { prefix: 'posts' }
    )
    const sql = result.query.toSQL()
    assert.match(sql.sql, /exists/i)
    assert.deepEqual(result.normalized.groupBy, 'status')
    assert.deepEqual((result.normalized.columns as Record<string, unknown>)['author.name'], {
      search: 'Ada',
    })
    assert.deepEqual((result.normalized.filters as Record<string, unknown>).trashed, 'only')
    assert.deepEqual(sql.bindings, ['%ada%'])
  })

  test('stores summary aggregates from column builder chains', ({ assert }) => {
    const column = tableBuilder.text('viewsCount').numeric().summarize(['sum', 'count']).definition
    assert.deepEqual(column.summaries, ['sum', 'count'])
  })
  test('editable column summarize builders retain runtime methods', ({ assert }) => {
    assert.deepEqual(tableBuilder.toggle('active').summarize(['count']).definition.summaries, [
      'count',
    ])
    assert.deepEqual(tableBuilder.checkbox('active').summarize(['count']).definition.summaries, [
      'count',
    ])
    assert.deepEqual(tableBuilder.select('status').summarize(['count']).definition.summaries, [
      'count',
    ])
    assert.deepEqual(tableBuilder.textInput('title').summarize(['count']).definition.summaries, [
      'count',
    ])
  })
  test('aggregates filtered summaries in SQL and matches the row-based result', async ({
    assert,
  }) => {
    await Post.createMany([
      { title: 'Draft A', slug: 'draft-a', status: 'draft', viewsCount: 3 },
      { title: 'Draft B', slug: 'draft-b', status: 'draft', viewsCount: 7 },
      { title: 'Published', slug: 'published', status: 'published', viewsCount: 100 },
    ])
    const filteredTable = {
      ...table,
      columns: [table.columns[2]!],
      filters: [{ kind: 'select' as const, name: 'status' }],
      defaultGroup: undefined,
    }
    const query = applyTableQuery(Post.query(), filteredTable, {
      filters: { status: 'draft' },
      groupBy: 'status',
    })
    const aggregate = await aggregateTableSummaries(query.query, filteredTable, {
      locale: 'en',
      timezone: 'UTC',
      normalized: query.normalized,
    })
    assert.match(aggregate.sql ?? '', /sum/i)
    assert.match(aggregate.sql ?? '', /group by/i)
    assert.match(aggregate.sql ?? '', /where/i)

    const rows = await Post.query().where('status', 'draft')
    const expected = await buildTableData(
      filteredTable,
      rows,
      {},
      {
        locale: 'en',
        timezone: 'UTC',
        normalized: query.normalized,
        rowActions: async () => [],
        rowUrl: () => undefined,
      }
    )
    assert.deepEqual(aggregate.groups?.draft?.viewsCount, expected.groups?.[0]?.summary?.viewsCount)
    assert.deepEqual(aggregate.groups?.draft?.viewsCount, {
      sum: '10',
      avg: '5',
      count: '2',
      range: '3 – 7',
    })
  })
})
