import { test } from '@japa/runner'
import { schema } from '../../../index.js'
import { DateTime, Settings } from 'luxon'
import { tableDescriptor, tableData } from '../../../catalog/wire.js'
import type { TableDefinition } from '../../../src/definition/table.js'
import { compileTable } from '../../../src/compiler/table_compiler.js'
import { buildTableData } from '../../../src/table/table_data.js'
import { setupDatabase, teardown, truncate, seed, Post } from '../../helpers/db.js'

const spec = { root: 'root', elements: { root: { type: 'Fragment', props: {} } } } as never
const table: TableDefinition = {
  columns: [
    {
      kind: 'text',
      name: 'title',
      searchable: true,
      sortable: true,
      limit: 20,
      description: ({ record }) => (record as { slug: string }).slug,
    },
    { kind: 'text', name: 'author.name' },
    { kind: 'badge', name: 'status', colors: { draft: 'gray', published: 'green' } },
    { kind: 'text', name: 'viewsCount', numeric: true },
    { kind: 'text', name: 'price', money: 'USD' },
    { kind: 'text', name: 'publishedAt', dateTime: true },
    { kind: 'text', name: 'publishedSince', since: true },
    { kind: 'image', name: 'cover', circular: true, stacked: true },
  ],
  filters: [
    { kind: 'select', name: 'status', options: { draft: 'Draft', published: 'Published' } },
    { kind: 'ternary', name: 'isFeatured' },
    { kind: 'dateRange', name: 'publishedAt' },
    { kind: 'custom', name: 'author', form: [] },
  ],
  filtersLayout: 'slideover',
  searchDebounce: 250,
  paginated: [10, 25, 'all'],
  striped: true,
  defaultSort: { column: 'title', direction: 'asc' },
}

test.group('table compiler', () => {
  test('compiles and validates the Post table descriptor', async ({ assert }) => {
    const descriptor = await compileTable(table, {
      url: '/admin/posts',
      id: 'posts',
      tabs: { all: { label: 'All posts' }, draft: { where: { status: 'draft' } } },
      bulkActions: [
        {
          name: 'delete',
          label: 'Delete',
          kind: 'confirm',
          url: '/admin/posts/actions/delete',
          enabled: true,
        },
      ],
      emptyStateAction: {
        name: 'create',
        label: 'Create post',
        kind: 'link',
        url: '/admin/posts/create',
        enabled: true,
      },
      compileFilterForm: async () => spec,
    })
    assert.deepEqual(tableDescriptor.parse(descriptor), descriptor)
    assert.snapshot(descriptor).match()
    assert.equal(descriptor.columns[0].props.hasDescription, true)
    assert.deepEqual(descriptor.perPageOptions, [10, 25, 'all'])
    assert.isTrue(descriptor.selectable)
    assert.equal(descriptor.layout, 'table')
    assert.isTrue(descriptor.striped)
  })
  test('emits text badge props and wrap at the descriptor level', async ({ assert }) => {
    const descriptor = await compileTable(
      {
        ...table,
        columns: [{ kind: 'text', name: 'title', badge: true, wrap: true }],
      },
      { url: '/posts', id: 'posts', bulkActions: [], compileFilterForm: async () => spec }
    )
    assert.deepEqual(descriptor.columns[0], {
      name: 'title',
      label: 'Title',
      type: 'text',
      sortable: false,
      searchable: false,
      wrap: true,
      props: { badge: true },
    })
  })

  test('wraps custom filter sub-specs in $raw without changing catalog output', async ({
    assert,
  }) => {
    const nested = {
      root: 'search',
      elements: {
        search: { type: 'Text', props: { value: { $bindState: '/data/term' } } },
      },
    }
    const descriptor = await compileTable(
      {
        ...table,
        filters: table.filters.map((filter, index) =>
          index === 3 ? { ...filter, form: [schema.text('term').toDefinition() as never] } : filter
        ),
      },
      {
        url: '/admin/posts',
        id: 'posts',
        bulkActions: [],
        compileFilterForm: async () => nested as never,
      }
    )
    assert.deepEqual(descriptor.filters[3]?.form?.spec, { $raw: nested })
    assert.snapshot(descriptor.filters[3]).match()
  })
})

test.group('table data formatting', (group) => {
  const originalNow = Settings.now
  const lockedNow = DateTime.fromISO('2026-03-29T02:00:00Z').toMillis()
  group.each.setup(async () => {
    await setupDatabase()
    await truncate()
    Settings.now = () => lockedNow
  })
  group.teardown(async () => {
    Settings.now = originalNow
    await teardown()
  })

  test('formats relation, money, date, since, badge and resolved image cells', async ({
    assert,
  }) => {
    const { users } = await seed({ users: [{ name: 'Ada', email: 'ada@table.test' }] })
    await seed({
      posts: [
        {
          title: 'A very long title that truncates',
          slug: 'ada-post',
          status: 'published',
          authorId: users[0].id,
          viewsCount: 1250,
          publishedAt: DateTime.fromISO('2026-03-29T01:30:00Z'),
          cover: 'covers/one.png',
        },
      ],
    })
    const record = await Post.query().preload('author').firstOrFail()
    const definition = {
      ...table,
      columns: table.columns.map((column) =>
        column.kind !== 'fragment' && column.name === 'price'
          ? { ...column, name: 'viewsCount', money: 'USD', numeric: false }
          : column
      ),
    }
    const data = await buildTableData(definition, [record], undefined, {
      locale: 'en-US',
      timezone: 'Europe/Amsterdam',
      normalized: { page: 1 },
      rowActions: async () => [],
      rowUrl: () => '/posts/1',
      resolveFileUrl: async (key) => `https://cdn.test/${key}`,
    })
    assert.deepEqual(tableData.parse(data), data)
    assert.equal(data.rows[0].cells['author.name'], 'Ada')
    assert.deepEqual(data.rows[0].cells.status, { value: 'published', color: 'green' })
    assert.equal(data.rows[0].cells.viewsCount, '$1,250.00')
    assert.equal(data.rows[0].cells.publishedAt, 'Mar 29, 2026, 3:30 AM')
    assert.equal(data.rows[0].cells.cover, 'https://cdn.test/covers/one.png')
    assert.equal(data.rows[0].url, '/posts/1')
    assert.equal(data.rows[0].key, record.id)
  })
  test('resolves every image key, preserves unresolved URLs, and honors recordUrl', async ({
    assert,
  }) => {
    const record = await Post.create({ title: 'URL test', slug: 'url-test', status: 'draft' })
    record.$attributes.cover = ['one.png', 'external.png']
    const data = await buildTableData(
      {
        ...table,
        columns: [{ kind: 'image', name: 'cover' }],
        recordUrl: ({ record: row }) => `/custom/${(row as Post).id}`,
      },
      [record],
      undefined,
      {
        locale: 'en',
        timezone: 'UTC',
        normalized: {},
        rowActions: async () => [],
        rowUrl: () => '/default',
        resolveFileUrl: async (key) => (key === 'one.png' ? `https://cdn.test/${key}` : null),
      }
    )
    assert.deepEqual(data.rows[0]?.cells.cover, ['https://cdn.test/one.png', 'external.png'])
    assert.equal(data.rows[0]?.url, `/custom/${record.id}`)
  })
})
