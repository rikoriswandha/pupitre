import { useCallback, useEffect, useState } from 'react'
import { catalogFixtures } from '@rikology/pupitre/catalog'
import type {
  ActionDescriptor,
  JsonRenderSpec,
  PupitrePageProps,
  TableData,
} from '@rikology/pupitre/catalog'
import { defineRegistry, PupitreRenderer, setFetch, setRouter } from '@rikology/pupitre-react'
import { ActionModal } from '@rikology/pupitre-react'
import { Shell } from '../../../src/components/Shell.js'
import { Modal } from '../../../src/components/Modal.js'
import { components } from '../../../src/components.js'
import { ConfirmDialog } from '../../../src/components/ConfirmDialog.js'
const actionDescriptor = {
  name: 'edit',
  label: 'Edit',
  kind: 'form' as const,
  url: '/actions/edit',
  enabled: true,
}
const noopToast = () => {}

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

function logRouterCall(entry: unknown) {
  const calls = (window as Window & { __ctRouterCalls?: unknown[] }).__ctRouterCalls ?? []
  calls.push(entry)
  ;(window as Window & { __ctRouterCalls?: unknown[] }).__ctRouterCalls = calls
  const output = document.querySelector('[data-testid="router-calls"]')
  if (output) output.textContent = JSON.stringify(calls)
}
function RouterLog() {
  useEffect(
    () =>
      setRouter({
        reload: (options?: unknown) => logRouterCall(options ?? {}),
        visit: (url: string, options?: { only?: string[] }) =>
          logRouterCall({ method: 'visit', url, only: options?.only }),
        put: (
          url: string,
          data: unknown,
          options?: {
            onError?: (errors: Record<string, string>) => void
            onSuccess?: () => void
          }
        ) => {
          logRouterCall({ method: 'put', url, data })
          if (url.endsWith('/focus-422')) options?.onError?.({ 'items.0.check': 'Required' })
          else if (url.endsWith('/422')) options?.onError?.({ title: 'Required' })
          else options?.onSuccess?.()
        },
        post: (url: string, data: unknown) => logRouterCall({ method: 'post', url, data }),
        on: () => () => {},
      } as never),
    []
  )
  return <pre data-testid="router-calls">[]</pre>
}

function fixturePage(name: string, spec?: JsonRenderSpec): PupitrePageProps['page'] {
  const fixture = spec ?? catalogFixtures[name as keyof typeof catalogFixtures]
  return {
    key: `ct:${String(name)}`,
    kind: 'custom',
    title: String(name),
    breadcrumbs: [],
    spec: fixture,
    state: 'state' in fixture ? (fixture.state ?? {}) : {},
    actions: { header: [] },
    catalogVersion: '0.3',
  }
}

export function FixtureStory({
  name,
  spec,
  upload = async () => ({}),
  errors,
}: {
  name: string
  /** Story-only spec variant; defaults to the catalog fixture called `name`. */
  spec?: JsonRenderSpec
  upload?: (field: string, files: File[]) => Promise<unknown>
  errors?: Record<string, unknown>
}) {
  const page = fixturePage(name, spec)
  return (
    <div data-testid="fixture-root">
      <PupitreRenderer
        page={page}
        pupitre={panel}
        registry={registry}
        runAction={async () => {}}
        upload={upload}
        errors={errors}
        toast={noopToast}
      />
      <RouterLog />
    </div>
  )
}

function RepeaterFixture({
  initialItems = [],
  itemLabel = 'Item',
  grid,
  addLabel = 'Add item',
}: {
  initialItems?: Array<{ _key: string; sku: string }>
  itemLabel?: unknown
  grid?: number
  addLabel?: string
}) {
  const page: PupitrePageProps['page'] = {
    key: 'ct:repeater',
    kind: 'custom',
    title: 'Repeater',
    breadcrumbs: [],
    spec: {
      root: 'repeat',
      elements: {
        repeat: {
          type: 'Repeater',
          props: { descriptor: { name: 'items', minItems: 0, addLabel, grid } },
          repeat: { statePath: '/data/items', key: '_key' },
          children: ['item'],
          on: {
            add: [
              {
                action: 'pushState',
                params: { statePath: '/data/items', value: { _key: '$id', sku: '' } },
              },
            ],
          },
        },
        item: {
          type: 'RepeaterItem',
          props: { index: { $index: true }, itemLabel },
          children: ['sku'],
          on: {
            remove: [
              {
                action: 'removeState',
                params: { statePath: '/data/items', index: { $index: true } },
              },
            ],
          },
        },
        sku: { type: 'Text', props: { name: 'sku', label: 'SKU', value: { $bindItem: 'sku' } } },
      },
    },
    state: { data: { items: initialItems } },
    actions: { header: [] },
    catalogVersion: '0.3',
  }
  return (
    <PupitreRenderer
      page={page}
      pupitre={panel}
      registry={registry}
      runAction={async () => {}}
      upload={async () => ({})}
      toast={noopToast}
    />
  )
}
export function RepeaterStory() {
  return <RepeaterFixture />
}
export function RepeaterItemLabelStory() {
  return (
    <RepeaterFixture
      initialItems={[
        { _key: 'a', sku: 'A-100' },
        { _key: 'b', sku: 'B-200' },
      ]}
      itemLabel={{ $template: 'SKU ${sku}' }}
    />
  )
}

export function DataTableStory() {
  return <FixtureStory name="DataTable" />
}
export function TabsStory() {
  const page: PupitrePageProps['page'] = {
    key: 'ct:tabs',
    kind: 'custom',
    title: 'Tabs',
    breadcrumbs: [],
    spec: {
      root: 'tabs',
      elements: {
        tabs: {
          type: 'Tabs',
          props: {
            id: 'interaction-tabs',
            tabs: [
              { key: 'details', label: 'Details' },
              { key: 'media', label: 'Media' },
            ],
            active: { $bindState: '/ui/tabs/interaction-tabs' },
          },
          children: ['details', 'media'],
        },
        details: {
          type: 'Tab',
          props: { key: 'details', label: 'Details' },
          children: ['detailsText'],
        },
        media: { type: 'Tab', props: { key: 'media', label: 'Media' }, children: ['mediaText'] },
        detailsText: {
          type: 'Text',
          props: { name: 'details', label: 'Details content', value: 'Details panel' },
        },
        mediaText: {
          type: 'Text',
          props: { name: 'media', label: 'Media content', value: 'Media panel' },
        },
      },
    },
    state: { data: {}, ui: { tabs: { 'interaction-tabs': 'details' } } },
    actions: { header: [] },
    catalogVersion: '0.3',
  }
  return (
    <PupitreRenderer
      page={page}
      pupitre={panel}
      registry={registry}
      runAction={async () => {}}
      upload={async () => ({})}
      toast={noopToast}
    />
  )
}
export function SelectStory() {
  return <FixtureStory name="Select" />
}
export function RichEditorStory() {
  return <FixtureStory name="RichEditor" />
}
export function MarkdownEditorStory() {
  return <FixtureStory name="MarkdownEditor" />
}
export function CodeEditorStory() {
  return <FixtureStory name="CodeEditor" />
}
export function CodeEditorBoundStory() {
  const fixture = catalogFixtures.CodeEditor
  return (
    <>
      {standalonePage('ct:CodeEditor', fixture, fixture.state)}
      <button
        type="button"
        onClick={() =>
          (
            window as Window & {
              __ctPupitreStore?: { set(path: string, value: unknown): void }
            }
          ).__ctPupitreStore?.set('/data/config', '{"external":true}')
        }
      >
        Set external value
      </button>
    </>
  )
}
export function CodeEditorReadonlyStory({ disabled = false }: { disabled?: boolean }) {
  const fixture = catalogFixtures.CodeEditor
  const root = fixture.elements.root as {
    type: string
    props: Record<string, unknown>
  }
  const readonlyFixture = {
    ...fixture,
    elements: {
      ...fixture.elements,
      root: { ...root, props: { ...root.props, readOnly: !disabled, disabled } },
    },
  } as JsonRenderSpec
  return standalonePage('ct:CodeEditorReadonly', readonlyFixture, fixture.state)
}
export function MarkdownEditorA11yStory() {
  const fixture = catalogFixtures.MarkdownEditor
  const root = fixture.elements.root as {
    type: string
    props: Record<string, unknown>
  }
  const spec = {
    ...fixture,
    elements: {
      ...fixture.elements,
      root: {
        ...root,
        props: { ...root.props, label: 'Body', helperText: 'Write Markdown content.' },
      },
    },
  } as JsonRenderSpec
  return <FixtureStory name="MarkdownEditorA11y" spec={spec} errors={{ summary: 'Required' }} />
}
export function UploadStory() {
  return <FixtureStory name="FileUpload" />
}

export function ActionStory() {
  const [calls, setCalls] = useState<unknown[]>([])
  const [open, setOpen] = useState(true)
  const [ready, setReady] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useEffect(() => {
    const restore = setFetch(async (input, init) => {
      const request = {
        url: String(input),
        method: init?.method ?? 'GET',
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      }
      setCalls((current) => [...current, request])
      const payload =
        request.method === 'GET'
          ? {
              spec: catalogFixtures.Text,
              state: catalogFixtures.Text.state ?? {},
              catalogVersion: '0.3',
            }
          : { flash: [], reload: false }
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    queueMicrotask(() => setReady(true))
    return restore
  }, [])
  return (
    <>
      {ready && open && (
        <ActionModal
          action={actionDescriptor}
          registry={registry.shell}
          runtimeRegistry={registry}
          pupitre={panel}
          close={close}
          toast={noopToast}
          onResult={() => {}}
        />
      )}
      <pre data-testid="router-calls">{JSON.stringify(calls)}</pre>
      <output data-testid="modal-open">{String(open)}</output>
    </>
  )
}

export function ConfirmStory() {
  useEffect(() => {
    ;(window as Window & { __ctConfirmRequests?: number }).__ctConfirmRequests = 0
  }, [])
  return (
    <ConfirmDialog
      open
      heading="Delete item?"
      onConfirm={() => {
        const requestLog = window as Window & { __ctConfirmRequests?: number }
        requestLog.__ctConfirmRequests = (requestLog.__ctConfirmRequests ?? 0) + 1
      }}
      onCancel={noopToast}
    />
  )
}

export function FormStory() {
  const page: PupitrePageProps['page'] = {
    key: 'ct:form',
    kind: 'edit',
    title: 'Edit post',
    breadcrumbs: [],
    spec: {
      root: 'form',
      elements: {
        form: {
          type: 'Form',
          props: { method: 'put', url: '/admin/posts/4', submitLabel: 'Save', dirtyGuard: false },
          children: ['title'],
        },
        title: {
          type: 'Text',
          props: { name: 'title', label: 'Title', value: { $bindState: '/data/title' } },
        },
      },
    },
    state: { data: { title: 'Draft' }, errors: {}, meta: {} },
    actions: { header: [] },
    catalogVersion: '0.3',
  }
  return (
    <div>
      <PupitreRenderer
        page={page}
        pupitre={panel}
        registry={registry}
        runAction={async () => {}}
        upload={async () => ({})}
        toast={noopToast}
      />
      <RouterLog />
    </div>
  )
}
function standalonePage(
  key: string,
  spec: NonNullable<PupitrePageProps['page']['spec']>,
  state: Record<string, unknown>,
  errors?: Record<string, unknown>,
  upload?: (field: string, files: File[]) => Promise<unknown>,
  options?: {
    data?: PupitrePageProps['data']
    runAction?: (
      action: ActionDescriptor,
      options?: { ids?: Array<string | number> }
    ) => Promise<void>
  }
) {
  const page: PupitrePageProps['page'] = {
    key,
    kind: 'custom',
    title: key,
    breadcrumbs: [],
    spec,
    state,
    actions: { header: [] },
    catalogVersion: '0.3',
  }
  return (
    <div>
      <PupitreRenderer
        page={page}
        pupitre={panel}
        registry={registry}
        runAction={options?.runAction ?? (async () => {})}
        upload={upload ?? (async () => ({}))}
        data={options?.data}
        toast={noopToast}
        errors={errors}
        onStore={(store) => {
          ;(
            window as Window & { __ctPupitreStore?: { get(path: string): unknown } }
          ).__ctPupitreStore = store
        }}
      />
      <RouterLog />
    </div>
  )
}

export function KeyValueStory() {
  return standalonePage(
    'key-value',
    {
      root: 'metadata',
      elements: {
        metadata: {
          type: 'KeyValue',
          props: { name: 'metadata', label: 'Metadata', value: { $bindState: '/data/metadata' } },
        },
      },
    } as never,
    { data: { metadata: { alpha: '1' } } }
  )
}

export function NumericSelectStory() {
  return standalonePage(
    'numeric-select',
    {
      root: 'category',
      elements: {
        category: {
          type: 'Select',
          props: {
            name: 'category',
            label: 'Category',
            value: { $bindState: '/data/category' },
            options: [{ value: '1', label: 'One' }],
          },
        },
      },
    } as never,
    { data: { category: 1 } }
  )
}

export function LiveBlurStory() {
  return standalonePage(
    'live-blur',
    {
      root: 'group',
      elements: {
        group: { type: 'Group', props: {}, children: ['search', 'visible'] },
        search: {
          type: 'Text',
          props: {
            name: 'search',
            label: 'Search',
            live: { onBlur: true },
            value: { $bindState: '/data/search' },
          },
        },
        visible: {
          type: 'Placeholder',
          props: { content: 'Matched' },
          visible: { $state: '/data/search', eq: 'match' },
        },
      },
    } as never,
    { data: { search: '' } }
  )
}

export function RepeaterErrorStory() {
  return standalonePage(
    'repeater-errors',
    {
      root: 'repeat',
      elements: {
        repeat: {
          type: 'Repeater',
          props: { descriptor: { name: 'items', minItems: 0, addLabel: 'Add item' } },
          repeat: { statePath: '/data/items', key: '_key' },
          children: ['item'],
        },
        item: {
          type: 'RepeaterItem',
          props: { index: { $index: true }, itemLabel: 'Item' },
          children: ['sku'],
        },
        sku: {
          type: 'Text',
          props: { name: 'sku', label: 'SKU', value: { $bindItem: 'sku' } },
        },
      },
    } as never,
    {
      data: {
        items: [
          { _key: 'first', sku: 'one' },
          { _key: 'second', sku: 'two' },
        ],
      },
    },
    { 'items.1.sku': 'Invalid SKU' }
  )
}

export function PersistedUploadStory({
  upload = async () => ({
    key: 'new-file.png',
    url: '/new-file.png',
    name: 'new-file.png',
    size: 1,
    mime: 'image/png',
  }),
}: {
  upload?: (field: string, files: File[]) => Promise<unknown>
}) {
  return standalonePage(
    'persisted-upload',
    {
      root: 'cover',
      elements: {
        cover: {
          type: 'FileUpload',
          props: {
            name: 'cover',
            label: 'Cover',
            value: { $bindState: '/data/cover' },
            descriptor: {
              name: 'cover',
              uploadUrl: '/upload',
              deleteUrl: '/upload',
              multiple: false,
              image: true,
              previewable: true,
              downloadable: true,
              reorderable: false,
            },
          },
        },
      },
    } as never,
    { data: { cover: 'persisted-cover.png' } },
    undefined,
    upload
  )
}

export function CustomFilterStory() {
  // Put the applied filter in the URL before the first render (browser-only story).
  useState(() =>
    window.history.replaceState({}, '', '/admin/posts?page=4&filters%5Brange%5D%5Bterm%5D=seeded')
  )
  return standalonePage(
    'custom-filter',
    {
      root: 'table',
      elements: {
        table: {
          type: 'DataTable',
          props: {
            descriptor: {
              id: 'posts',
              url: '/admin/posts',
              columns: [],
              filters: [
                {
                  type: 'custom',
                  name: 'range',
                  label: 'Range',
                  form: {
                    // Same shape the server compiles: nested specs are `$raw` so the
                    // outer renderer does not resolve their expressions.
                    spec: {
                      $raw: {
                        root: 'form',
                        elements: {
                          form: {
                            type: 'Form',
                            props: {
                              method: 'get',
                              url: '/admin/posts',
                              submitLabel: 'Apply',
                              dirtyGuard: false,
                            },
                            children: ['term'],
                          },
                          term: {
                            type: 'Text',
                            props: {
                              name: 'term',
                              label: 'Term',
                              value: { $bindState: '/data/term' },
                            },
                          },
                        },
                        state: { data: { term: 'default' } },
                      },
                    },
                  },
                },
              ],
              filtersLayout: 'above',
              perPageOptions: [10],
              searchable: false,
              searchDebounce: 300,
              selectable: false,
              bulkActions: [],
              layout: 'table',
            },
          },
        },
      },
    } as never,
    { data: {}, errors: {}, meta: {} }
  )
}
export function NativeClearableSelectStory() {
  return standalonePage(
    'native-clearable-select',
    {
      root: 'category',
      elements: {
        category: {
          type: 'Select',
          props: {
            name: 'category',
            label: 'Category',
            native: true,
            clearable: true,
            value: { $bindState: '/data/category' },
            options: [{ value: '1', label: 'One' }],
          },
        },
      },
    } as never,
    { data: { category: '1' } }
  )
}
export function StaticSelectActionsStory() {
  return standalonePage(
    'static-select-actions',
    {
      root: 'category',
      elements: {
        category: {
          type: 'Select',
          props: {
            name: 'category',
            label: 'Category',
            value: { $bindState: '/data/category' },
            options: [{ value: '1', label: 'One' }],
            prefixAction: { ...actionDescriptor, name: 'prefix', label: 'Prefix action' },
            suffixAction: { ...actionDescriptor, name: 'suffix', label: 'Suffix action' },
          },
        },
      },
    } as never,
    { data: { category: '1' } },
    undefined,
    undefined,
    {
      runAction: async (action) => {
        const log = window as Window & { __staticSelectActions?: string[] }
        log.__staticSelectActions ??= []
        log.__staticSelectActions.push(action.name)
      },
    }
  )
}
export function AsyncSelectControlsStory() {
  useEffect(
    () =>
      setFetch(
        async () =>
          new Response(
            JSON.stringify({
              options: [
                { value: 'culture', label: 'Culture' },
                { value: 'design', label: 'Design' },
              ],
              hasMore: true,
            })
          )
      ),
    []
  )
  return standalonePage(
    'async-select-controls',
    {
      root: 'fields',
      elements: {
        fields: {
          type: 'Group',
          props: {},
          children: ['tags', 'disabled', 'readonly'],
        },
        tags: {
          type: 'Select',
          props: {
            name: 'tags',
            label: 'Tags',
            value: { $bindState: '/data/tags' },
            optionsUrl: '/options',
            multiple: true,
            searchable: true,
            required: true,
            hint: 'Choose tags',
            helperText: 'Tag selection',
            error: 'Choose at least one tag',
          },
        },
        disabled: {
          type: 'Select',
          props: {
            name: 'disabled',
            label: 'Disabled',
            value: { $bindState: '/data/disabled' },
            optionsUrl: '/options',
            searchable: true,
            disabled: true,
            createOption: { url: '/options/create' },
          },
        },
        readonly: {
          type: 'Select',
          props: {
            name: 'readonly',
            label: 'Read only',
            value: { $bindState: '/data/readonly' },
            optionsUrl: '/options',
            searchable: true,
            readOnly: true,
            createOption: { url: '/options/create' },
          },
        },
      },
    } as never,
    { data: { tags: ['culture'], disabled: 'culture', readonly: 'design' } }
  )
}

export function TextSuffixStory() {
  return standalonePage(
    'text-suffix',
    {
      root: 'code',
      elements: { code: { type: 'Text', props: { label: 'Code', suffix: '.ts', value: '' } } },
    } as never,
    { data: {} }
  )
}
export function DirtyFailureStory() {
  return standalonePage(
    'dirty-failure',
    {
      root: 'form',
      elements: {
        form: {
          type: 'Form',
          props: {
            method: 'put',
            url: '/admin/posts/422',
            submitLabel: 'Save',
            dirtyGuard: true,
          },
          children: ['title'],
        },
        title: {
          type: 'Text',
          props: { name: 'title', label: 'Title', value: { $bindState: '/data/title' } },
        },
      },
    } as never,
    { data: { title: 'Draft' }, errors: {}, meta: {} }
  )
}
export function RepeaterLayoutStory() {
  return (
    <RepeaterFixture
      initialItems={[
        { _key: 'first', sku: 'A-100' },
        { _key: 'second', sku: 'B-200' },
      ]}
      grid={2}
      addLabel="Add SKU"
    />
  )
}

export function KeyValueInvalidStory() {
  return standalonePage(
    'key-value-invalid',
    {
      root: 'metadata',
      elements: {
        metadata: {
          type: 'KeyValue',
          props: {
            name: 'metadata',
            label: 'Metadata',
            reorderable: true,
            value: { $bindState: '/data/metadata' },
          },
        },
      },
    } as never,
    { data: { metadata: { alpha: '1', beta: '2', gamma: '3' } } }
  )
}

export function TableContractStory() {
  const action: ActionDescriptor = {
    name: 'publish',
    label: 'Publish selected',
    kind: 'direct',
    url: '/posts/publish',
    method: 'post',
    enabled: true,
    keyBindings: ['ctrl+p'],
  }
  const tableData: TableData = {
    rows: [
      {
        key: 7,
        cells: { status: 'Ready', title: 'This title wraps onto more than one line' },
        actions: [
          {
            name: 'view',
            label: 'View',
            variant: 'link',
            kind: 'link',
            url: '/posts/7',
            enabled: true,
          },
          {
            name: 'edit',
            label: 'Edit',
            variant: 'button',
            kind: 'direct',
            url: '/edit',
            enabled: true,
          },
          {
            name: 'inspect',
            label: 'Inspect',
            icon: 'eye',
            variant: 'iconButton',
            kind: 'direct',
            url: '/inspect',
            enabled: true,
          },
        ],
        selectable: true,
      },
    ],
    meta: { total: 1, perPage: 10, currentPage: 1, lastPage: 1, from: 1, to: 1 },
    query: {},
  }
  return standalonePage(
    'table-contract',
    {
      root: 'table',
      elements: {
        table: {
          type: 'DataTable',
          props: {
            descriptor: {
              id: 'posts',
              url: '/posts',
              columns: [
                {
                  name: 'status',
                  label: 'Status',
                  type: 'text',
                  sortable: false,
                  searchable: false,
                  props: { badge: true, colors: { Ready: 'rgb(1, 2, 3)' } },
                },
                {
                  name: 'title',
                  label: 'Title',
                  type: 'text',
                  sortable: false,
                  searchable: false,
                  wrap: true,
                  props: {},
                },
              ],
              filters: [],
              filtersLayout: 'above',
              perPageOptions: [10],
              searchable: false,
              searchDebounce: 0,
              selectable: true,
              bulkActions: [action],
              layout: 'table',
            },
          },
        },
      },
    } as never,
    { data: {}, errors: {}, meta: {} },
    undefined,
    undefined,
    {
      data: tableData,
      runAction: async (descriptor, options) => {
        const calls = (window as Window & { __ctActions?: unknown[] }).__ctActions ?? []
        calls.push({ action: descriptor.name, ids: options?.ids })
        ;(window as Window & { __ctActions?: unknown[] }).__ctActions = calls
      },
    }
  )
}

export function SectionFieldContractStory() {
  return standalonePage(
    'section-field-contract',
    {
      root: 'section',
      elements: {
        section: {
          type: 'Section',
          props: { heading: 'Details', icon: 'settings' },
          children: ['checkbox', 'toggle', 'actions'],
        },
        checkbox: {
          type: 'Checkbox',
          props: { name: 'active', label: 'Active', inline: true, value: true },
        },
        toggle: {
          type: 'Toggle',
          props: {
            name: 'enabled',
            label: 'Enabled',
            inline: true,
            onColor: 'rgb(10, 20, 30)',
            offColor: 'rgb(40, 50, 60)',
            value: { $bindState: '/data/enabled' },
          },
        },
        actions: {
          type: 'Actions',
          props: {
            actions: [
              {
                name: 'link-action',
                label: 'Open',
                kind: 'direct',
                url: '/open',
                enabled: true,
                variant: 'link',
              },
              {
                name: 'icon-action',
                label: 'Inspect header',
                icon: 'eye',
                kind: 'direct',
                url: '/inspect',
                enabled: true,
                variant: 'iconButton',
              },
            ],
          },
        },
      },
    } as never,
    { data: { enabled: true } }
  )
}

export function NestedNamesStory() {
  return standalonePage(
    'nested-names',
    {
      root: 'repeat',
      elements: {
        repeat: {
          type: 'Repeater',
          props: { descriptor: { name: 'items', minItems: 0 } },
          repeat: { statePath: '/data/items', key: '_key' },
          children: ['item'],
        },
        item: {
          type: 'RepeaterItem',
          props: { index: { $index: true }, itemLabel: 'Fields' },
          children: ['check', 'choices', 'radio', 'toggle', 'tags', 'hidden'],
        },
        check: {
          type: 'Checkbox',
          props: { name: 'check', label: 'Check', value: { $bindItem: 'check' } },
        },
        choices: {
          type: 'CheckboxList',
          props: {
            name: 'choices',
            label: 'Choices',
            options: [{ value: 'a', label: 'A' }],
            value: { $bindItem: 'choices' },
          },
        },
        radio: {
          type: 'Radio',
          props: {
            name: 'radio',
            label: 'Radio',
            options: [{ value: 'a', label: 'A' }],
            value: { $bindItem: 'radio' },
          },
        },
        toggle: {
          type: 'Toggle',
          props: { name: 'toggle', label: 'Toggle', value: { $bindItem: 'toggle' } },
        },
        tags: {
          type: 'Tags',
          props: { name: 'tags', label: 'Tags', value: { $bindItem: 'tags' } },
        },
        hidden: { type: 'Hidden', props: { name: 'hidden', value: { $bindItem: 'hidden' } } },
      },
    } as never,
    {
      data: {
        items: [
          {
            _key: 'one',
            check: false,
            choices: [],
            radio: 'a',
            toggle: false,
            tags: [],
            hidden: 'x',
          },
        ],
      },
    }
  )
}

export function ThemeShellStory({ darkMode = 'dark' }: { darkMode?: 'dark' | 'light' | 'system' }) {
  const [modalActionClicked, setModalActionClicked] = useState(false)
  return (
    <Shell
      panel={{
        id: 'Theme',
        path: '/admin',
        brand: { name: 'Theme', favicon: '/test-favicon.ico' },
        theme: { darkMode, primary: 'rgb(12, 34, 56)' },
        features: {},
      }}
      user={null}
      nav={[]}
      breadcrumbs={[]}
      title="Theme"
      headerActions={[]}
      currentUrl="/admin"
      tenant={null}
      tenants={[]}
    >
      <Modal open heading="Portal dialog" onClose={() => {}}>
        <div>
          <button type="button" onClick={() => setModalActionClicked(true)}>
            Modal action
          </button>
          <output data-testid="modal-action">{modalActionClicked ? 'clicked' : ''}</output>
        </div>
      </Modal>
    </Shell>
  )
}

export function UploadSaveStory() {
  return standalonePage(
    'upload-save',
    {
      root: 'form',
      elements: {
        form: {
          type: 'Form',
          props: { method: 'put', url: '/posts/1', submitLabel: 'Save', dirtyGuard: false },
          children: ['cover'],
        },
        cover: {
          type: 'FileUpload',
          props: {
            name: 'cover',
            label: 'Cover',
            value: { $bindState: '/data/cover' },
            descriptor: {
              name: 'cover',
              uploadUrl: '/upload',
              deleteUrl: '/upload',
              multiple: false,
              image: false,
              previewable: false,
              downloadable: false,
              reorderable: false,
            },
          },
        },
      },
    } as never,
    { data: { cover: null }, meta: {} },
    undefined,
    async () => ({ key: 'saved-file.png', name: 'saved-file.png', size: 1, mime: 'image/png' })
  )
}
export function DefaultToggleStory() {
  return standalonePage(
    'default-toggle',
    {
      root: 'toggle',
      elements: {
        toggle: {
          type: 'Toggle',
          props: {
            name: 'enabled',
            label: 'Enabled',
            value: { $bindState: '/data/enabled' },
          },
        },
      },
    } as never,
    { data: { enabled: true } }
  )
}

export function SearchDebounceStory() {
  return standalonePage(
    'search-debounce',
    {
      root: 'table',
      elements: {
        table: {
          type: 'DataTable',
          props: {
            descriptor: {
              id: 'search',
              url: '/search',
              columns: [],
              filters: [],
              filtersLayout: 'above',
              perPageOptions: [10],
              searchable: true,
              searchDebounce: 150,
              selectable: false,
              bulkActions: [],
              layout: 'table',
            },
          },
        },
      },
    } as never,
    { data: {}, meta: {} },
    undefined,
    undefined,
    {
      data: {
        rows: [],
        meta: { total: 0, perPage: 10, currentPage: 1, lastPage: 1, from: 0, to: 0 },
        query: {},
      },
    }
  )
}
export function NestedFormFocusStory() {
  return standalonePage(
    'nested-form-focus',
    {
      root: 'form',
      elements: {
        form: {
          type: 'Form',
          props: {
            method: 'put',
            url: '/admin/1/focus-422',
            submitLabel: 'Submit',
            dirtyGuard: false,
          },
          children: ['repeat'],
        },
        repeat: {
          type: 'Repeater',
          props: { descriptor: { name: 'items', minItems: 0 } },
          repeat: { statePath: '/data/items', key: '_key' },
          children: ['item'],
        },
        item: {
          type: 'RepeaterItem',
          props: { index: { $index: true }, itemLabel: 'Fields' },
          children: ['check'],
        },
        check: {
          type: 'Checkbox',
          props: { name: 'check', label: 'Check', value: { $bindItem: 'check' } },
        },
      },
    } as never,
    { data: { items: [{ _key: 'one', check: false }] }, meta: {} }
  )
}
