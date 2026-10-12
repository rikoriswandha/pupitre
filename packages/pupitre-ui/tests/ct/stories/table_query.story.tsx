import { useLayoutEffect, useState } from 'react'
import type { TableDescriptor } from '@rikology/pupitre/catalog'
import { setRouter } from '@rikology/pupitre-react'
import { DataTable } from '../../../src/components/DataTable.js'
import { DataTableQueryBuilder } from '../../../src/components/DataTableQueryBuilder.js'
import { configureI18n } from '../../../../pupitre-react/src/i18n.js'
import { DataTableEditableCell } from '../../../src/components/DataTableEditableCell.js'
import { DataTableGroups } from '../../../src/components/DataTableGroups.js'
import { RuntimeContext } from '../../../../pupitre-react/src/runtime.js'

export function TableQueryStory({
  layout = 'above',
  deferred = false,
  singleSort = false,
  reorderable = false,
}: {
  layout?: 'above' | 'dropdown' | 'slideover'
  deferred?: boolean
  singleSort?: boolean
  reorderable?: boolean
}) {
  const [url, setUrl] = useState('')
  useLayoutEffect(() => {
    window.history.replaceState({}, '', window.location.pathname)
    return setRouter({
      visit: (next: string) => {
        window.history.replaceState({}, '', next)
        setUrl(next)
      },
      on: () => () => {},
    } as never)
  }, [])
  const descriptor = {
    id: 'query',
    url: '/posts',
    columns: ['title', 'price', 'published'].map((name) => ({
      name,
      label: name === 'title' ? 'Title' : name === 'price' ? 'Price' : 'Published',
      type: 'text',
      sortable: true,
      searchable: false,
      props: {},
    })),
    multiSort: singleSort ? undefined : 2,
    defaultSorts: reorderable ? undefined : [{ column: 'title', direction: 'asc' }],
    reorderable: reorderable ? { url: '/posts/reorder' } : undefined,
    filters: singleSort
      ? []
      : [
          {
            name: 'query',
            type: 'queryBuilder',
            label: 'Advanced query',
            constraints: [
              {
                name: 'title',
                label: 'Title',
                type: 'text',
                operators: [
                  { value: 'contains', label: 'Contains' },
                  { value: 'blank', label: 'Is blank' },
                ],
              },
              {
                name: 'price',
                label: 'Price',
                type: 'number',
                operators: [
                  { value: 'between', label: 'Between' },
                  { value: 'greaterThan', label: 'Greater than' },
                ],
              },
              {
                name: 'published',
                label: 'Published',
                type: 'date',
                operators: [
                  { value: 'on', label: 'On' },
                  { value: 'between', label: 'Between' },
                ],
              },
              {
                name: 'featured',
                label: 'Featured',
                type: 'boolean',
                operators: [
                  { value: 'true', label: 'Is true' },
                  { value: 'false', label: 'Is false' },
                ],
              },
              {
                name: 'status',
                label: 'Status',
                type: 'select',
                options: [
                  { value: 'draft', label: 'Draft' },
                  { value: 'live', label: 'Live' },
                ],
                operators: [{ value: 'anyOf', label: 'Any of' }],
              },
              {
                name: 'comments',
                label: 'Comments',
                type: 'relationship',
                operators: [
                  { value: 'has', label: 'Has related records' },
                  { value: 'minCount', label: 'Minimum count' },
                ],
              },
            ],
          },
        ],
    filtersLayout: layout,
    deferFilters: deferred,
    perPageOptions: [],
    searchable: false,
    searchDebounce: 0,
    selectable: false,
    bulkActions: [],
    layout: 'table',
  } as TableDescriptor
  return (
    <main>
      <DataTable
        props={{ descriptor }}
        emit={() => {}}
        tableData={
          {
            rows: [
              { key: 1, cells: { title: 'A', price: 12, published: '2026-10-12' }, actions: [] },
            ],
            query: {},
          } as never
        }
      />
      <output aria-label="Visited URL">{url}</output>
    </main>
  )
}

export function QueryLimitStory({ long = false, prefix }: { long?: boolean; prefix?: string }) {
  const [value, setValue] = useState(
    JSON.stringify({
      groups: Array.from({ length: 4 }, () =>
        Array.from({ length: long ? 1 : 16 }, () => ({
          constraint: 'title',
          operator: 'contains',
          value: long ? '漢'.repeat(500) : 'x',
        }))
      ),
    })
  )
  const [applied, setApplied] = useState(false)
  return (
    <main>
      <DataTableQueryBuilder
        filter={{
          name: 'query',
          label: 'Advanced query',
          constraints: [
            {
              name: 'title',
              type: 'text',
              label: 'Title',
              operators: [{ value: 'contains', label: 'Contains' }],
            },
          ],
        }}
        value={value}
        queryPrefix={prefix}
        onApply={(next) => {
          setValue(next)
          setApplied(true)
        }}
      />
      <output aria-label="Applied query">{applied ? value : ''}</output>
    </main>
  )
}

export function TableMessageStory() {
  configureI18n('en', {
    '{column}, row {row}': 'Baris {row}: {column}',
    'Edit {column}, {value}, row {row}': 'Baris {row}: ubah {column} ({value})',
    '{count} rows': { one: '{count} row', other: '{count} rows' },
  })
  useLayoutEffect(() => () => configureI18n('en'), [])
  return (
    <main>
      <RuntimeContext.Provider value={{ toast: () => {} } as never}>
        <DataTableEditableCell
          column={{
            name: 'title',
            label: 'Title',
            type: 'textInput',
            sortable: false,
            searchable: false,
            props: {},
            editable: { url: '/posts/:id/title' },
          }}
          rowKey={7}
          value="Original"
          serverValue="Original"
          onChange={() => 1}
          onSettled={() => {}}
          onEditingChange={() => {}}
        />
        <DataTableGroups
          groups={[
            {
              key: 'draft',
              label: 'Draft',
              rows: [{ key: 7, cells: {}, actions: [], selectable: false }],
            },
          ]}
          columns={[]}
          definition={{ key: 'status', label: 'Status', collapsible: true }}
          layout="grid"
          colSpan={1}
          renderRows={() => <p>Grouped record</p>}
        />
      </RuntimeContext.Provider>
    </main>
  )
}
