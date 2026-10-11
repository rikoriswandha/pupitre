import { test } from '@japa/runner'
import { tableDescriptor } from '../../../catalog/wire.js'
import type { TableDefinition } from '../../../src/definition/table.js'
import { compileTable } from '../../../src/compiler/table_compiler.js'
import { table } from '../../../index.js'

const emptySpec = { root: 'root', elements: { root: { type: 'Fragment', props: {} } } } as never

const base: TableDefinition = {
  columns: [
    { kind: 'toggle', name: 'isFeatured', editable: true },
    { kind: 'select', name: 'status', editable: true, options: { draft: 'Draft' } },
    {
      kind: 'textInput',
      name: 'title',
      editable: true,
      validation: { required: true, maxLength: 20 },
    },
    { kind: 'checkbox', name: 'active', editable: true },
  ],
  filters: [],
  filtersLayout: 'dropdown',
  searchDebounce: 250,
  paginated: [10],
  striped: false,
  reorderable: 'sortOrder',
  poll: '30s',
  deferFilters: true,
  layout: { type: 'grid', columns: { default: 1, md: 2, xl: 3 } },
}

test.group('table interaction compiler', () => {
  test('compiles editable routes, polling, reorder, filter deferral and grid columns', async ({
    assert,
  }) => {
    const descriptor = await compileTable(base, {
      url: '/admin/posts',
      id: 'posts',
      bulkActions: [],
      compileFilterForm: async () => emptySpec,
    })
    assert.deepEqual(tableDescriptor.parse(descriptor), descriptor)
    assert.deepEqual(
      descriptor.columns.map((column) => column.editable?.url),
      [
        '/admin/posts/:id/column/isFeatured',
        '/admin/posts/:id/column/status',
        '/admin/posts/:id/column/title',
        '/admin/posts/:id/column/active',
      ]
    )
    assert.deepEqual(descriptor.reorderable, { url: '/admin/posts/reorder' })
    assert.deepEqual(descriptor.defaultSort, { column: 'sortOrder', direction: 'asc' })
    assert.equal(descriptor.poll, 30_000)

    assert.isTrue(descriptor.deferFilters)
    assert.deepEqual(descriptor.gridColumns, { default: 1, md: 2, xl: 3 })
  })
  test('keeps common fluent column methods available after validation configuration', ({
    assert,
  }) => {
    const original = table.textInput('title')
    const configured = original
      .validation({ required: true, maxLength: 10 })
      .sortable()
      .searchable()
      .label('Title')
      .toggleable({ hiddenByDefault: true })
    assert.isUndefined(original.definition.validation)
    assert.equal(configured.definition.validation?.maxLength, 10)
    assert.isTrue(configured.definition.sortable)
    assert.isTrue(configured.definition.searchable)
    assert.deepEqual(configured.definition.toggleable, { hiddenByDefault: true })
  })
})
