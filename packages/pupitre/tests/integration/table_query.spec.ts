import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type { TableDefinition } from '../../src/definition/table.js'
import { E_PUPITRE_INVALID_SORT } from '../../src/query/table_query.js'
import { applyTableQuery } from '../../src/query/table_query.js'
import { setupDatabase, teardown, truncate, seed, Post } from '../helpers/db.js'

const table: TableDefinition = {
  columns: [
    { kind: 'text', name: 'title', searchable: true, sortable: true },
    { kind: 'text', name: 'author.name', searchable: true, sortable: true },
    { kind: 'badge', name: 'status', sortable: true },
    { kind: 'text', name: 'isFeatured', sortable: true },
    { kind: 'text', name: 'publishedAt', sortable: true },
    { kind: 'text', name: 'viewsCount', sortable: true },
  ],
  filters: [
    { kind: 'select', name: 'status', options: { draft: 'Draft', published: 'Published' } },
    { kind: 'select', name: 'authors', attribute: 'authorId', multiple: true },
    { kind: 'ternary', name: 'isFeatured' },
    { kind: 'dateRange', name: 'publishedAt' },
    {
      kind: 'custom',
      name: 'author',
      query: (query, data) => query.where('author_id', data.authorId as number),
    },
  ],
  filtersLayout: 'dropdown',
  searchDebounce: 300,
  paginated: [10, 25, 'all'],
  striped: false,
  defaultSort: { column: 'title', direction: 'desc' },
}

const pgOnly = process.env.DB !== 'pg'
/** Case-insensitive search SQL differs per dialect: ILIKE on PostgreSQL, lower() LIKE elsewhere. */
const searchSql = (column: string) =>
  process.env.DB === 'pg'
    ? new RegExp(`${column}\\W*\\s+ilike`, 'i')
    : new RegExp(`lower\\(.*${column}.*\\) like`, 'i')

test.group('table query', (group) => {
  group.each.setup(async () => {
    await setupDatabase()
    await truncate()
  })
  group.teardown(async () => teardown())

  test('applies ascending and descending sort', async ({ assert }) => {
    const db = await setupDatabase()
    const asc = applyTableQuery(db.modelQuery(Post) as never, table, { sort: 'title' })
    const desc = applyTableQuery(db.modelQuery(Post) as never, table, { sort: '-title' })
    assert.match(asc.query.toSQL().sql, /order by .*title.* asc/i)
    assert.deepEqual(asc.query.toSQL().bindings, [])
    assert.match(desc.query.toSQL().sql, /order by .*title.* desc/i)
    assert.deepEqual(desc.query.toSQL().bindings, [])
    assert.equal(asc.normalized.sort, 'title')
    const defaultSort = applyTableQuery(db.modelQuery(Post) as never, table, {})
    assert.match(defaultSort.query.toSQL().sql, /order by .*title.* desc/i)
    assert.deepEqual(defaultSort.query.toSQL().bindings, [])
    assert.equal(defaultSort.normalized.sort, '-title')
  })

  test('sorts relation columns with a correlated subquery', async ({ assert }) => {
    const db = await setupDatabase()
    const result = applyTableQuery(db.modelQuery(Post) as never, table, { sort: 'author.name' })
    const sql = result.query.toSQL()
    assert.match(sql.sql, /select .*name.* from .*users/i)
    assert.notMatch(sql.sql, /join/i)
    assert.deepEqual(sql.bindings, [])
  })

  test('searches ordinary and relation columns and returns matching records', async ({
    assert,
  }) => {
    const { users } = await seed({
      users: [
        { name: 'Ada Lovelace', email: 'ada@example.test' },
        { name: 'Grace Hopper', email: 'grace@example.test' },
      ],
    })
    await seed({
      posts: [
        { title: 'Compiler', slug: 'compiler', status: 'draft', authorId: users[0].id },
        { title: 'Database', slug: 'database', status: 'published', authorId: users[1].id },
      ],
    })
    const db = await setupDatabase()
    const params = applyTableQuery(db.modelQuery(Post) as never, table, { q: 'ADA' })
    const sql = params.query.toSQL()
    assert.match(sql.sql, searchSql('title'))
    assert.match(sql.sql, /exists/i)
    // ILIKE keeps the term as typed; the lower() LIKE fallback lowercases it.
    const term = process.env.DB === 'pg' ? '%ADA%' : '%ada%'
    assert.deepEqual(sql.bindings, [term, term])
    const rows = await params.query.exec()
    assert.deepEqual(
      rows.map((row) => (row as Post).slug),
      ['compiler']
    )
  })

  test('maps camelCase related search attributes to database column names', async ({ assert }) => {
    const { users } = await seed({
      users: [{ name: 'Grace', fullName: 'Ada Lovelace', email: 'mapped@example.test' }],
    })
    await seed({
      posts: [
        {
          title: 'Mapped relation',
          slug: 'mapped-relation',
          status: 'draft',
          authorId: users[0].id,
        },
      ],
    })
    const db = await setupDatabase()
    const mappedTable: TableDefinition = {
      ...table,
      columns: [{ kind: 'text', name: 'author.fullName', searchable: true, sortable: true }],
      defaultSort: undefined,
    }
    const result = applyTableQuery(db.modelQuery(Post) as never, mappedTable, { q: 'Ada' })
    assert.match(result.query.toSQL().sql, searchSql('full_name'))
    const rows = await result.query.exec()
    assert.deepEqual(
      rows.map((row) => (row as Post).slug),
      ['mapped-relation']
    )
  })

  test('applies single and multiple select filters; ignores unknown names', async ({ assert }) => {
    const db = await setupDatabase()
    const single = applyTableQuery(db.modelQuery(Post) as never, table, {
      filters: { status: 'draft', ignored: 'x' },
    })
    const multiple = applyTableQuery(db.modelQuery(Post) as never, table, {
      filters: { authors: ['1', '2'] },
    })
    assert.match(single.query.toSQL().sql, /status.*=/i)
    assert.deepEqual(single.query.toSQL().bindings, ['draft'])
    assert.deepEqual(multiple.query.toSQL().bindings, ['1', '2'])
    assert.match(multiple.query.toSQL().sql, /author_id.*in/i)
  })

  test('applies boolean ternary true/false and ignores blank', async ({ assert }) => {
    const db = await setupDatabase()
    const yes = applyTableQuery(db.modelQuery(Post) as never, table, {
      filters: { isFeatured: 'true' },
    })
    const no = applyTableQuery(db.modelQuery(Post) as never, table, {
      filters: { isFeatured: false },
    })
    const blank = applyTableQuery(db.modelQuery(Post) as never, table, {
      filters: { isFeatured: 'blank' },
    })
    assert.match(yes.query.toSQL().sql, /is_featured.*=/i)
    assert.deepEqual(yes.query.toSQL().bindings, [true])
    assert.deepEqual(no.query.toSQL().bindings, [false])
    assert.deepEqual(blank.query.toSQL().bindings, [])
    assert.match(no.query.toSQL().sql, /is_featured.*=/i)
    assert.notMatch(blank.query.toSQL().sql, /is_featured/i)
  })

  test('applies date ranges in configured timezone', async ({ assert }) => {
    const db = await setupDatabase()
    const result = applyTableQuery(
      db.modelQuery(Post) as never,
      table,
      {
        filters: { publishedAt: { from: '2026-01-01', to: '2026-01-01' } },
      },
      { ctx: { pupitre: { timezone: 'Asia/Jakarta' } } as never }
    )
    assert.match(result.query.toSQL().sql, /published_at.*between/i)
    const bindings = result.query.toSQL().bindings.map(String)
    assert.match(bindings[0], /2025-12-31/)
    assert.match(bindings[1], /2026-01-01/)
  })

  test('applies custom filters and tab where predicates', async ({ assert }) => {
    const db = await setupDatabase()
    const result = applyTableQuery(
      db.modelQuery(Post) as never,
      table,
      {
        filters: { author: { authorId: 3 } },
        tab: 'draft',
      },
      { tabs: { draft: { where: { status: 'draft' } } } }
    )
    assert.match(result.query.toQuery(), /author_id.*status/i)
    assert.deepEqual(result.query.toSQL().bindings, [3, 'draft'])
    assert.deepEqual(result.normalized.tab, 'draft')
  })
  test('applies the first tab when no tab is requested and ignores unknown tabs', async ({
    assert,
  }) => {
    const db = await setupDatabase()
    const tabs = { draft: { where: { status: 'draft' } }, all: {} }
    const implicit = applyTableQuery(db.modelQuery(Post) as never, table, {}, { tabs })
    assert.deepEqual(implicit.query.toSQL().bindings, ['draft'])
    // The default is not echoed, so URLs and saved views stay free of the implicit tab.
    assert.isUndefined(implicit.normalized.tab)
    const unknown = applyTableQuery(db.modelQuery(Post) as never, table, { tab: 'gone' }, { tabs })
    assert.deepEqual(unknown.query.toSQL().bindings, ['draft'])
    const chosen = applyTableQuery(db.modelQuery(Post) as never, table, { tab: 'all' }, { tabs })
    assert.deepEqual(chosen.query.toSQL().bindings, [])
    assert.equal(chosen.normalized.tab, 'all')
  })
  test('applies the user query callback before URL predicates', async ({ assert }) => {
    const db = await setupDatabase()
    const withScope: TableDefinition = {
      ...table,
      query: (query) => query.where('tenant_id', 7),
    }
    const result = applyTableQuery(
      db.modelQuery(Post) as never,
      withScope,
      { filters: { status: 'draft' }, tab: 'draft' },
      { tabs: { draft: { where: { status: 'draft' } } } }
    )
    assert.deepEqual(result.query.toSQL().bindings, [7, 'draft', 'draft'])
  })

  test('normalizes pagination and rejects disallowed all pagination', async ({ assert }) => {
    const db = await setupDatabase()
    const accepted = applyTableQuery(db.modelQuery(Post) as never, table, {
      perPage: 'all',
      page: '3',
    })
    const rejected = applyTableQuery(
      db.modelQuery(Post) as never,
      { ...table, paginated: [10, 25] },
      { perPage: 'all' }
    )
    assert.equal(accepted.perPage, 'all')
    assert.equal(accepted.page, 3)
    assert.equal(rejected.perPage, 10)
    assert.equal(rejected.page, 1)
  })

  test('rejects sorting by a non-sortable column with a 400 error', async ({ assert }) => {
    const db = await setupDatabase()
    const invalid = {
      ...table,
      columns: [{ kind: 'text', name: 'title' as const }],
    } as TableDefinition
    let error: unknown
    try {
      applyTableQuery(db.modelQuery(Post) as never, invalid, { sort: 'title' })
    } catch (caught) {
      error = caught
    }
    assert.instanceOf(error, E_PUPITRE_INVALID_SORT)
    if (error && typeof error === 'object') {
      assert.equal('status' in error ? error.status : undefined, 400)
      assert.match(
        'message' in error && typeof error.message === 'string' ? error.message : '',
        /title/
      )
    }
  })

  test('uses ILIKE on PostgreSQL', ({ assert }) => {
    if (pgOnly) return
    const db = setupDatabase()
    return db.then((database) => {
      const result = applyTableQuery(database.modelQuery(Post) as never, table, { q: 'post' })
      assert.match(result.query.toQuery(), /ilike/i)
    })
  }).tags(['@pg'])

  test('seeded date values include Luxon UTC instances', async ({ assert }) => {
    const { posts } = await seed({
      posts: [{ title: 'Zone', slug: 'zone', status: 'draft', publishedAt: DateTime.utc() }],
    })
    assert.isTrue(DateTime.isDateTime(posts[0].publishedAt))
  })
})
