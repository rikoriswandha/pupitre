import { useEffect } from 'react'
import {
  catalogFixtures,
  type JsonRenderSpec,
  type PupitrePageProps,
  type TableData,
} from '@rikology/pupitre/catalog'
import { defineRegistry, PupitreRenderer, setRouter } from '@rikology/pupitre-react'
import { components } from '../../../src/components.js'
import { FixtureStory } from './catalog.story.js'

const registry = defineRegistry(components)
const panel: PupitrePageProps['pupitre'] = {
  panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
  user: null,
  tenant: null,
  nav: [],
  flash: [],
  locale: 'en',
  timezone: 'UTC',
}
const options = [
  { value: 'draft', label: 'Draft' },
  { value: 'locked', label: 'Locked', disabled: true },
  { value: 'published', label: 'Published' },
]
export function ChoiceA11yStory({
  kind,
  multiple = false,
  async = false,
}: {
  kind: 'Select' | 'Radio' | 'ToggleButtons'
  multiple?: boolean
  async?: boolean
}) {
  const spec: JsonRenderSpec = {
    root: 'field',
    elements: {
      field: {
        type: kind,
        props: {
          name: 'status',
          label: 'Status',
          required: true,
          multiple,
          value: { $bindState: '/data/status' },
          options,
          ...(async ? { optionsUrl: '/a11y/options', searchable: true, preload: true } : {}),
        },
      },
    },
    state: { data: { status: multiple ? [] : 'draft' } },
  }
  return <FixtureStory name={kind} spec={spec} />
}
export function TabsA11yStory({ duplicate = false }: { duplicate?: boolean }) {
  const tabs = [
    { key: 'first', label: 'First' },
    { key: 'disabled', label: 'Disabled', disabled: true },
    { key: 'last', label: 'Last' },
  ]
  const scopes = duplicate ? ['one', 'two'] : ['one']
  const elements: JsonRenderSpec['elements'] = {
    root: { type: 'Group', props: {}, children: scopes },
  }
  for (const scope of scopes) {
    elements[scope] = {
      type: 'Tabs',
      props: { label: 'Sections', tabs, active: { $bindState: `/data/${scope}` } },
      children: tabs.map((tab) => `${scope}-${tab.key}`),
    }
    for (const tab of tabs) {
      elements[`${scope}-${tab.key}`] = { type: 'Tab', props: { key: tab.key } }
    }
  }
  return (
    <FixtureStory
      name="Tabs"
      spec={{
        root: 'root',
        elements,
        state: { data: { one: 'first', two: 'first' } },
      }}
    />
  )
}
export function TableA11yStory({ sort = '' }: { sort?: string }) {
  useEffect(() => {
    window.history.replaceState({}, '', `/a11y/posts${sort ? `?sort=${sort}` : ''}`)
    return setRouter({ visit: () => {}, reload: () => {}, on: () => () => {} } as never)
  }, [sort])
  const data: TableData = {
    rows: [1, 2].map((key) => ({
      key,
      cells: { title: `Post ${key}`, status: 'Draft', enabled: key === 1, icon: 'published' },
      selectable: true,
      actions: [
        {
          name: 'edit',
          label: 'Edit',
          group: 'Row actions',
          kind: 'direct',
          url: '/edit',
          enabled: true,
        },
      ],
    })),
    query: sort ? { sort } : {},
    meta: { total: 2, perPage: 10, currentPage: 1, lastPage: 1, from: 1, to: 2 },
  }
  const spec: JsonRenderSpec = {
    root: 'table',
    elements: {
      table: {
        type: 'DataTable',
        props: {
          descriptor: {
            id: 'a11y-posts',
            url: '/a11y/posts',
            label: 'Posts',
            columns: [
              {
                name: 'title',
                label: 'Title',
                type: 'text',
                sortable: true,
                searchable: true,
                props: {},
              },
              {
                name: 'status',
                label: 'Status',
                type: 'text',
                sortable: false,
                searchable: false,
                toggleable: { hiddenByDefault: false },
                props: {},
              },
              {
                name: 'enabled',
                label: 'Enabled',
                type: 'toggle',
                sortable: false,
                searchable: false,
                props: {},
              },
              {
                name: 'icon',
                label: 'Icon',
                type: 'icon',
                sortable: false,
                searchable: false,
                props: { icons: { published: '✓' } },
              },
            ],
            filters: [
              {
                name: 'status',
                label: 'Status',
                type: 'select',
                options: [{ value: 'draft', label: 'Draft' }],
              },
            ],
            filtersLayout: 'dropdown',
            perPageOptions: [10],
            searchable: true,
            searchDebounce: 300,
            selectable: true,
            bulkActions: [],
            layout: 'table',
          },
        },
      },
    },
  }
  return (
    <PupitreRenderer
      page={{
        key: 'a11y-table',
        kind: 'custom',
        title: 'Posts',
        breadcrumbs: [],
        spec,
        state: {},
        actions: { header: [] },
        catalogVersion: '1.0',
      }}
      pupitre={panel}
      registry={registry}
      upload={async () => ({})}
      data={data}
      runAction={async () => {}}
      toast={() => {}}
    />
  )
}
export function UploadA11yStory() {
  return (
    <FixtureStory
      name="FileUpload"
      spec={{
        root: 'upload',
        elements: {
          upload: {
            type: 'FileUpload',
            props: {
              label: 'Attachment',
              helperText: 'Upload a document.',
              error: 'Required',
              required: true,
              descriptor: {
                name: 'attachment',
                uploadUrl: '/upload',
                deleteUrl: '/upload',
                multiple: false,
                image: false,
                reorderable: false,
                downloadable: false,
                previewable: false,
              },
            },
          },
        },
      }}
    />
  )
}
export function EditorA11yStory({
  kind,
}: {
  kind: 'RichEditor' | 'MarkdownEditor' | 'CodeEditor'
}) {
  const fixture = catalogFixtures[kind]
  const root = fixture.elements.root
  return (
    <FixtureStory
      name={kind}
      spec={{
        ...fixture,
        elements: {
          ...fixture.elements,
          root: {
            ...root,
            props: {
              ...root.props,
              label: 'Body',
              helperText: 'Enter content.',
              error: 'Required',
            },
          },
        },
      }}
    />
  )
}
export function InteractiveFixtureA11yStory({
  name,
}: {
  name:
    | 'FileUpload'
    | 'Wizard'
    | 'Step'
    | 'Builder'
    | 'Repeater'
    | 'Widget.Chart'
    | 'Widget.Stats'
    | 'Widget.Timeline'
    | 'Widget.Table'
}) {
  if (name === 'Repeater') {
    const fixture = catalogFixtures.Repeater
    return (
      <FixtureStory
        name={name}
        spec={{
          ...fixture,
          elements: {
            ...fixture.elements,
            root: {
              ...fixture.elements.root,
              repeat: { statePath: '/data/items', key: '_key' },
              on: {
                add: [
                  {
                    action: 'pushState',
                    params: {
                      statePath: '/data/items',
                      value: { _key: '$id', sku: '' },
                    },
                  },
                ],
              },
            },
          },
          state: { data: { items: [] } },
        }}
      />
    )
  }
  return <FixtureStory name={name} />
}
