import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { qb, table as columns } from '../../index.js'
import type { TableDefinition } from '../../src/definition/table.js'
import { applyTableQuery } from '../../src/query/table_query.js'
import { E_PUPITRE_INVALID_QUERY } from '../../src/query/query_builder.js'
import { setupDatabase, teardown, truncate, seed, Post } from '../helpers/db.js'
import { aggregateTableSummaries } from '../../src/table/table_summary.js'
import { Table } from '../../src/builder/table/table.js'
import { BaseModel, column } from '@adonisjs/lucid/orm'

class CalendarPost extends BaseModel {
  static table = 'posts'
  @column({ isPrimary: true }) declare id: number
  @column.date() declare publishedAt: DateTime
}

const constraints = [
  qb.text('title'),
  qb.text('body'),
  qb.number('viewsCount').integer(),
  qb.date('publishedAt'),
  qb.boolean('isFeatured'),
  qb.select('status').options({ draft: 'Draft', published: 'Published' }),
  qb.relationship('author', 'name'),
]
const table: TableDefinition = {
  columns: [
    columns.text('title').sortable().toDefinition(),
    columns.text('viewsCount').sortable().toDefinition(),
  ],
  filters: [columns.filter.queryBuilder().constraints(constraints).toDefinition()],
  filtersLayout: 'dropdown',
  searchDebounce: 300,
  paginated: false,
  striped: false,
  multiSort: 3,
}
const encoded = (groups: unknown[][]) => ({ filters: { query: JSON.stringify({ groups }) } })

test.group('query builder', (suite) => {
  suite.each.setup(async () => {
    await setupDatabase()
    await truncate()
  })
  suite.teardown(() => teardown())
  test('extended-year next-day date bounds are rejected before SQL', ({ assert }) => {
    for (const operator of ['on', 'after', 'between']) {
      for (const model of [Post, CalendarPost]) {
        assert.throws(
          () =>
            applyTableQuery(
              model.query() as never,
              table,
              encoded([
                [
                  {
                    constraint: 'publishedAt',
                    operator,
                    value: operator === 'between' ? ['9999-12-30', '9999-12-31'] : '9999-12-31',
                  },
                ],
              ])
            ),
          /date/
        )
      }
    }
  })
  test('integer and safe-number rules reject invalid values before SQL execution', async ({
    assert,
  }) => {
    for (const value of [1.5, 3000000000, 1e21]) {
      assert.throws(
        () =>
          applyTableQuery(
            Post.query() as never,
            table,
            encoded([[{ constraint: 'viewsCount', operator: 'equals', value }]])
          ),
        /number/
      )
    }
    assert.throws(
      () =>
        applyTableQuery(
          Post.query() as never,
          table,
          encoded([[{ constraint: 'author', operator: 'minCount', value: 1e21 }]])
        ),
      /number/
    )
    const decimal = {
      ...table,
      filters: [
        columns.filter
          .queryBuilder()
          .constraints([qb.number('viewsCount')])
          .toDefinition(),
      ],
    }
    const parsed = applyTableQuery(
      Post.query() as never,
      decimal,
      encoded([[{ constraint: 'viewsCount', operator: 'greaterThan', value: 1.5 }]])
    )
    assert.equal(
      JSON.parse((parsed.normalized.filters as Record<string, string>).query).groups[0][0].value,
      1.5
    )
    assert.throws(
      () =>
        applyTableQuery(
          Post.query() as never,
          decimal,
          encoded([[{ constraint: 'viewsCount', operator: 'equals', value: 1e21 }]])
        ),
      /number/
    )
  })
  test('calendar and timezone bounds reject PostgreSQL year zero before SQL execution', async ({
    assert,
  }) => {
    for (const value of ['0000-01-01', '0001-01-01']) {
      const dated = {
        ...table,
        filters: [
          columns.filter
            .queryBuilder()
            .constraints([qb.date('publishedAt').timezone('Asia/Jakarta')])
            .toDefinition(),
        ],
      }
      assert.throws(
        () =>
          applyTableQuery(
            Post.query() as never,
            dated,
            encoded([[{ constraint: 'publishedAt', operator: 'on', value }]])
          ),
        /date/
      )
      assert.throws(
        () =>
          applyTableQuery(
            CalendarPost.query() as never,
            dated,
            encoded([[{ constraint: 'publishedAt', operator: 'on', value }]])
          ),
        /date/
      )
    }
  })
  test('literal non-ASCII text matches exact stored capitals using the same SQL folding', async ({
    assert,
  }) => {
    await seed({ users: [{ name: 'Éclair', email: 'eclair@example.test' }] })
    const { users } = await seed({ users: [{ name: 'Élodie', email: 'elodie@example.test' }] })
    await seed({
      posts: [{ title: 'Éclair', slug: 'unicode', status: 'draft', authorId: users[0].id }],
    })
    for (const operator of ['equals', 'contains', 'startsWith', 'endsWith']) {
      for (const [constraint, value] of [
        ['title', 'Éclair'],
        ['author', 'Élodie'],
      ]) {
        const rows = await applyTableQuery(
          Post.query() as never,
          table,
          encoded([[{ constraint, operator, value }]])
        ).query
        assert.lengthOf(rows, 1, `${constraint}/${operator}`)
      }
    }
  })
  test('all typed operators and negation return matching records with bound literal values', async ({
    assert,
  }) => {
    const { users } = await seed({ users: [{ name: 'Ada Lovelace', email: 'qb@example.test' }] })
    await seed({
      posts: [
        {
          title: 'Alpha%_End',
          slug: 'a',
          status: 'published',
          body: '',
          viewsCount: 120,
          isFeatured: true,
          publishedAt: DateTime.fromISO('2026-01-02T12:00:00Z', { zone: 'UTC' }),
          authorId: users[0].id,
        },
        {
          title: 'Beta',
          slug: 'b',
          status: 'draft',
          body: 'Body',
          viewsCount: 20,
          isFeatured: false,
          publishedAt: DateTime.fromISO('2026-01-01T12:00:00Z', { zone: 'UTC' }),
        },
        {
          title: 'Gamma',
          slug: 'c',
          status: 'draft',
          body: null,
          viewsCount: 0,
          isFeatured: false,
          publishedAt: null,
        },
      ],
    })
    const cases: [string, string, unknown, string[]][] = [
      ['title', 'contains', '%_', ['a']],
      ['title', 'startsWith', 'ALPHA', ['a']],
      ['title', 'endsWith', 'END', ['a']],
      ['title', 'equals', 'beta', ['b']],
      ['body', 'blank', undefined, ['a', 'c']],
      ['viewsCount', 'equals', '20', ['b']],
      ['viewsCount', 'notEquals', 20, ['a', 'c']],
      ['viewsCount', 'greaterThan', 20, ['a']],
      ['viewsCount', 'greaterThanOrEqual', 20, ['a', 'b']],
      ['viewsCount', 'lessThan', 20, ['c']],
      ['viewsCount', 'lessThanOrEqual', 20, ['b', 'c']],
      ['viewsCount', 'between', ['10', '120'], ['a', 'b']],
      ['publishedAt', 'before', '2026-01-02', ['b']],
      ['publishedAt', 'after', '2026-01-01', ['a']],
      ['publishedAt', 'on', '2026-01-02', ['a']],
      ['publishedAt', 'between', ['2026-01-01', '2026-01-02'], ['a', 'b']],
      ['publishedAt', 'blank', undefined, ['c']],
      ['isFeatured', 'true', undefined, ['a']],
      ['isFeatured', 'false', undefined, ['b', 'c']],
      ['status', 'anyOf', ['published'], ['a']],
      ['status', 'noneOf', ['published'], ['b', 'c']],
      ['author', 'has', undefined, ['a']],
      ['author', 'hasNone', undefined, ['b', 'c']],
      ['author', 'minCount', 1, ['a']],
      ['author', 'contains', 'LOVELACE', ['a']],
      ['author', 'startsWith', 'Ada', ['a']],
      ['author', 'endsWith', 'lace', ['a']],
      ['author', 'equals', 'Ada Lovelace', ['a']],
      ['author', 'blank', undefined, []],
    ]
    for (const [constraint, operator, value, expected] of cases) {
      const query = Post.query()
      const result = applyTableQuery(
        query as never,
        table,
        encoded([[{ constraint, operator, ...(value === undefined ? {} : { value }) }]])
      )
      const rows = await result.query.orderBy('slug')
      assert.deepEqual(
        rows.map((row) => row.serialize().slug),
        expected,
        `${constraint}/${operator}`
      )
      const negated = applyTableQuery(
        Post.query() as never,
        table,
        encoded([
          [{ constraint, operator, ...(value === undefined ? {} : { value }), negated: true }],
        ])
      )
      const negatedRows = await negated.query.orderBy('slug')
      const eligible =
        constraint === 'publishedAt' && operator !== 'blank' ? ['a', 'b'] : ['a', 'b', 'c']
      assert.deepEqual(
        negatedRows.map((row) => row.serialize().slug),
        eligible.filter((slug) => !expected.includes(slug)),
        `negation ${constraint}/${operator}`
      )
    }
  })
  test('multiple independent OR trees cannot escape tenant and soft-delete predicates', async ({
    assert,
  }) => {
    await seed({
      posts: [
        { title: 'Own A', slug: 'a', status: 'published', tenantId: 1, viewsCount: 20 },
        { title: 'Own B', slug: 'b', status: 'draft', tenantId: 1, viewsCount: 120 },
        { title: 'Foreign A', slug: 'x', status: 'published', tenantId: 2, viewsCount: 20 },
        { title: 'Foreign B', slug: 'y', status: 'draft', tenantId: 2, viewsCount: 120 },
        {
          title: 'Deleted',
          slug: 'z',
          status: 'published',
          tenantId: 1,
          viewsCount: 120,
          deletedAt: DateTime.utc(),
        },
      ],
    })
    const groups = [
      [{ constraint: 'status', operator: 'anyOf', value: ['published'] }],
      [{ constraint: 'viewsCount', operator: 'greaterThan', value: 100 }],
    ]
    for (const trashed of ['without', 'with', 'only']) {
      const base = Post.query().where('tenantId', 1)
      if (trashed === 'without') base.whereNull('deletedAt')
      if (trashed === 'only') base.whereNotNull('deletedAt')
      const result = applyTableQuery(base as never, table, encoded(groups))
      const secondTable = {
        ...table,
        filters: [columns.filter.queryBuilder('second').constraints(constraints).toDefinition()],
      }
      const second = applyTableQuery(result.query, secondTable, {
        filters: {
          second: JSON.stringify({
            groups: [
              [{ constraint: 'title', operator: 'startsWith', value: 'Own' }],
              [{ constraint: 'title', operator: 'equals', value: 'Deleted' }],
            ],
          }),
        },
      })
      const secondRows = await second.query.orderBy('slug')
      assert.deepEqual(
        secondRows.map((row) => row.serialize().slug),
        trashed === 'without' ? ['a', 'b'] : trashed === 'only' ? ['z'] : ['a', 'b', 'z']
      )
    }
  })
  test('strict malformed rules produce 400 before SQL', ({ assert }) => {
    const invalid = [
      'no-json',
      '{}',
      JSON.stringify({ groups: [] }),
      JSON.stringify({ groups: [[{ constraint: 'missing', operator: 'equals', value: 'x' }]] }),
      JSON.stringify({ groups: [[{ constraint: 'title', operator: 'sql', value: 'x' }]] }),
      JSON.stringify({
        groups: [[{ constraint: 'viewsCount', operator: 'equals', value: 'NaN' }]],
      }),
      JSON.stringify({
        groups: [[{ constraint: 'publishedAt', operator: 'on', value: '2026-02-30' }]],
      }),
      JSON.stringify({
        groups: [[{ constraint: 'status', operator: 'anyOf', value: ['missing'] }]],
      }),
      JSON.stringify({
        groups: Array.from({ length: 9 }, () => [
          { constraint: 'title', operator: 'equals', value: 'x' },
        ]),
      }),
      JSON.stringify({
        groups: [[{ constraint: 'title', operator: 'equals', value: 'x'.repeat(501) }]],
      }),
      JSON.stringify({ groups: [[]] }),
      JSON.stringify({
        groups: [[{ constraint: 'title', operator: 'blank', value: 'unexpected' }]],
      }),
      JSON.stringify({
        groups: [[{ constraint: 'viewsCount', operator: 'between', value: [20, 10] }]],
      }),
      JSON.stringify({ groups: [[{ constraint: 'viewsCount', operator: 'equals', value: [] }]] }),
      JSON.stringify({ groups: [[{ constraint: 'author', operator: 'minCount', value: 1.5 }]] }),
      JSON.stringify({
        groups: [[{ constraint: 'title', operator: 'equals', value: 'x', negated: 'yes' }]],
      }),
      JSON.stringify({
        groups: [[{ constraint: 'title', operator: 'equals', value: 'x', injection: 'OR 1=1' }]],
      }),
      JSON.stringify({
        groups: [
          Array.from({ length: 17 }, () => ({
            constraint: 'title',
            operator: 'equals',
            value: 'x',
          })),
        ],
      }),
      JSON.stringify({
        groups: Array.from({ length: 5 }, () =>
          Array.from({ length: 13 }, () => ({
            constraint: 'title',
            operator: 'equals',
            value: 'x',
          }))
        ),
      }),
      JSON.stringify({
        groups: [
          [
            {
              constraint: 'status',
              operator: 'anyOf',
              value: Array.from({ length: 51 }, () => 'draft'),
            },
          ],
        ],
      }),
      'x'.repeat(8193),
    ]
    for (const value of invalid) {
      try {
        applyTableQuery(Post.query() as never, table, { filters: { query: value } })
        assert.fail('must reject')
      } catch (error) {
        assert.instanceOf(error, E_PUPITRE_INVALID_QUERY)
        if (error instanceof E_PUPITRE_INVALID_QUERY) assert.equal(error.status, 400)
      }
    }
  })
  test('date values use the effective panel timezone', async ({ assert }) => {
    await seed({
      posts: [
        {
          title: 'Local day',
          slug: 'zone',
          status: 'draft',
          publishedAt: DateTime.fromISO('2026-01-01T18:00:00Z', { zone: 'UTC' }),
        },
      ],
    })
    const result = applyTableQuery(
      Post.query() as never,
      table,
      encoded([[{ constraint: 'publishedAt', operator: 'on', value: '2026-01-02' }]]),
      { ctx: { pupitre: { timezone: 'Asia/Jakarta' } } as never }
    )
    assert.lengthOf(await result.query, 1)
  })
  test('explicit constraint timezone respects DST calendar day boundaries', async ({ assert }) => {
    await seed({
      posts: [
        {
          title: 'Before',
          slug: 'before',
          status: 'draft',
          publishedAt: DateTime.fromISO('2026-03-28T22:59:00Z', { zone: 'UTC' }),
        },
        {
          title: 'Start',
          slug: 'start',
          status: 'draft',
          publishedAt: DateTime.fromISO('2026-03-28T23:00:00Z', { zone: 'UTC' }),
        },
        {
          title: 'End',
          slug: 'end',
          status: 'draft',
          publishedAt: DateTime.fromISO('2026-03-29T21:59:00Z', { zone: 'UTC' }),
        },
        {
          title: 'After',
          slug: 'after',
          status: 'draft',
          publishedAt: DateTime.fromISO('2026-03-29T22:00:00Z', { zone: 'UTC' }),
        },
      ],
    })
    const zoned = {
      ...table,
      filters: [
        columns.filter
          .queryBuilder()
          .constraints([qb.date('publishedAt').timezone('Europe/Amsterdam')])
          .toDefinition(),
      ],
    }
    const loaded = applyTableQuery(
      Post.query() as never,
      zoned,
      encoded([[{ constraint: 'publishedAt', operator: 'on', value: '2026-03-29' }]]),
      { ctx: { pupitre: { timezone: 'Asia/Jakarta' } } as never }
    )
    const rows = await loaded.query.clearOrder().orderBy('slug')
    assert.deepEqual(
      rows.map((row) => row.serialize().slug),
      ['end', 'start']
    )
  })
  test('Lucid date columns remain calendar dates without timezone shifting', async ({ assert }) => {
    const { posts } = await seed({
      posts: [{ title: 'Calendar', slug: 'calendar', status: 'draft' }],
    })
    const database = await setupDatabase()
    await database.from('posts').where('id', posts[0].id).update({ published_at: '2026-03-29' })
    const calendarTable = {
      ...table,
      filters: [
        columns.filter
          .queryBuilder()
          .constraints([qb.date('publishedAt').timezone('Asia/Jakarta')])
          .toDefinition(),
      ],
    }
    const loaded = applyTableQuery(
      CalendarPost.query() as never,
      calendarTable,
      encoded([[{ constraint: 'publishedAt', operator: 'on', value: '2026-03-29' }]])
    )
    const rows = await loaded.query
    assert.deepEqual(
      rows.map((row) => row.$primaryKeyValue),
      [posts[0].id]
    )
    assert.deepEqual(loaded.query.toSQL().bindings, ['2026-03-29', '2026-03-30'])
  })
  test('multi-sort orders rows and retains old single-sort links and explicit clearing', async ({
    assert,
  }) => {
    await seed({
      posts: [
        { title: 'Same', slug: 'low', status: 'draft', viewsCount: 2 },
        { title: 'Same', slug: 'high', status: 'draft', viewsCount: 10 },
        { title: 'Zed', slug: 'z', status: 'draft', viewsCount: 0 },
      ],
    })
    const result = applyTableQuery(Post.query() as never, table, { sort: 'title,-viewsCount' })
    const sortedRows = await result.query
    assert.deepEqual(
      sortedRows.map((row) => row.serialize().slug),
      ['high', 'low', 'z']
    )
    const defaults = new Table(table)
      .multiSort()
      .defaultSort([
        { column: 'title', direction: 'asc' },
        { column: 'viewsCount', direction: 'desc' },
      ])
      .toDefinition()
    const defaultRows = await applyTableQuery(Post.query() as never, defaults, {}).query
    assert.deepEqual(
      defaultRows.map((row) => row.serialize().slug),
      ['high', 'low', 'z']
    )
    const cleared = applyTableQuery(
      Post.query() as never,
      { ...defaults, reorderable: 'viewsCount' },
      { sort: '' }
    )
    const reorderedRows = await cleared.query
    assert.deepEqual(
      reorderedRows.map((row) => row.serialize().slug),
      ['z', 'low', 'high']
    )
    assert.equal(cleared.normalized.sort, '')
    assert.throws(
      () =>
        new Table({ ...table, multiSort: undefined })
          .defaultSort(defaults.defaultSorts!)
          .toDefinition(),
      /multiSort limit/
    )
    assert.throws(
      () =>
        new Table(table)
          .defaultSort([
            { column: 'title', direction: 'asc' },
            { column: 'title', direction: 'desc' },
          ])
          .toDefinition(),
      /repeat/
    )
    assert.equal(
      applyTableQuery(Post.query() as never, table, { sort: '-title' }).normalized.sort,
      '-title'
    )
    assert.equal(
      applyTableQuery(
        Post.query() as never,
        { ...table, defaultSort: { column: 'title', direction: 'asc' } },
        { sort: '' }
      ).normalized.sort,
      ''
    )
    assert.throws(() =>
      applyTableQuery(
        Post.query() as never,
        { ...table, multiSort: undefined },
        { sort: 'title,-viewsCount' }
      )
    )
    assert.throws(() => applyTableQuery(Post.query() as never, table, { sort: 'title,body' }))
    assert.throws(() => applyTableQuery(Post.query() as never, table, { sort: 'title,-title' }))
  })
  test('summaries and groups aggregate the same scoped OR-filtered query', async ({ assert }) => {
    await seed({
      posts: [
        { title: 'A', slug: 'a', status: 'published', tenantId: 1, viewsCount: 20 },
        { title: 'B', slug: 'b', status: 'draft', tenantId: 1, viewsCount: 120 },
        { title: 'Excluded', slug: 'c', status: 'draft', tenantId: 1, viewsCount: 2 },
        { title: 'Foreign', slug: 'x', status: 'published', tenantId: 2, viewsCount: 999 },
      ],
    })
    const summarized: TableDefinition = {
      ...table,
      columns: [columns.text('viewsCount').numeric().summarize(['sum', 'count']).toDefinition()],
      groups: [{ key: 'status' }],
    }
    const filtered = applyTableQuery(Post.query().where('tenantId', 1) as never, summarized, {
      ...encoded([
        [{ constraint: 'status', operator: 'anyOf', value: ['published'] }],
        [{ constraint: 'viewsCount', operator: 'greaterThan', value: 100 }],
      ]),
      groupBy: 'status',
    })
    const result = await aggregateTableSummaries(filtered.query, summarized, {
      locale: 'en',
      timezone: 'UTC',
      normalized: filtered.normalized,
    })
    assert.equal(result.groups?.published.viewsCount.sum, '20')
    assert.equal(result.groups?.draft.viewsCount.sum, '120')
    const totals = await aggregateTableSummaries(filtered.query, summarized, {
      locale: 'en',
      timezone: 'UTC',
      normalized: { ...filtered.normalized, groupBy: undefined },
    })
    assert.equal(totals.summary?.viewsCount.sum, '140')
    assert.equal(totals.summary?.viewsCount.count, '2')
  })
  test('64 short rules fit the real URL budget and oversized encoded queries fail', async ({
    assert,
  }) => {
    await seed({ posts: [{ title: 'abc', slug: 'abc', status: 'draft' }] })
    const groups = Array.from({ length: 4 }, () =>
      Array.from({ length: 16 }, () => ({
        constraint: 'title',
        operator: 'contains',
        value: 'abc',
      }))
    )
    const params = encoded(groups)
    assert.isBelow(
      new URLSearchParams({ 'filters[query]': params.filters.query }).toString().length,
      8192
    )
    const loaded = applyTableQuery(Post.query() as never, table, params)
    assert.lengthOf(await loaded.query, 1)
    const oversized = encoded([
      Array.from({ length: 12 }, () => ({
        constraint: 'title',
        operator: 'contains',
        value: '%'.repeat(500),
      })),
    ])
    assert.isBelow(Buffer.byteLength(oversized.filters.query), 8192)
    assert.throws(() => applyTableQuery(Post.query() as never, table, oversized), /URL limit/)
    const legacy = applyTableQuery(
      Post.query() as never,
      { ...table, filters: [] },
      { ignored: 'x'.repeat(9000) }
    )
    assert.lengthOf(await legacy.query, 1)
  })
  test('qualified deterministic tiebreaker works when joins expose another id column', async ({
    assert,
  }) => {
    const { users } = await seed({
      users: [{ name: 'Joined author', email: 'joined@example.test' }],
    })
    const { posts } = await seed({
      posts: [
        { title: 'Same', slug: 'first', status: 'draft', authorId: users[0].id },
        { title: 'Same', slug: 'second', status: 'draft', authorId: users[0].id },
      ],
    })
    const query = Post.query().select('posts.*').join('users', 'users.id', 'posts.author_id')
    const loaded = applyTableQuery(query as never, table, { sort: 'title' })
    const rows = await loaded.query
    assert.deepEqual(
      rows.map((row) => row.$primaryKeyValue),
      posts.map((post) => post.id)
    )
  })
  test('PostgreSQL datetime bounds retain UTC instants with a non-UTC session', async ({
    assert,
  }) => {
    const database = await setupDatabase()
    await seed({
      posts: [
        {
          title: 'Before',
          slug: 'before',
          status: 'draft',
          publishedAt: DateTime.fromISO('2026-01-01T23:00:00Z', { zone: 'UTC' }),
        },
        {
          title: 'Start',
          slug: 'start',
          status: 'draft',
          publishedAt: DateTime.fromISO('2026-01-02T00:00:00Z', { zone: 'UTC' }),
        },
        {
          title: 'End',
          slug: 'end',
          status: 'draft',
          publishedAt: DateTime.fromISO('2026-01-02T23:59:00Z', { zone: 'UTC' }),
        },
      ],
    })
    await database.connection().rawQuery("SET TIME ZONE 'Asia/Jakarta'")
    try {
      const loaded = applyTableQuery(
        Post.query() as never,
        table,
        encoded([[{ constraint: 'publishedAt', operator: 'on', value: '2026-01-02' }]])
      )
      const rows = await loaded.query.clearOrder().orderBy('slug')
      assert.deepEqual(
        rows.map((row) => row.serialize().slug),
        ['end', 'start']
      )
      assert.deepEqual(loaded.query.toSQL().bindings, [
        '2026-01-02T00:00:00.000Z',
        '2026-01-03T00:00:00.000Z',
      ])
    } finally {
      await database.connection().rawQuery('RESET TIME ZONE')
    }
  })
    .skip(process.env.DB !== 'pg', 'Requires explicit PostgreSQL test database')
    .tags(['@pg'])
})
