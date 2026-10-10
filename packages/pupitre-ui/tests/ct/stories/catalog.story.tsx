import { useCallback, useEffect, useState } from 'react'
import { catalogFixtures } from '@rikology/pupitre/catalog'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import { defineRegistry, PupitreRenderer, setFetch, setRouter } from '@rikology/pupitre-react'
import { ActionModal } from '@rikology/pupitre-react'
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
          options?: { onError?: (errors: Record<string, string>) => void }
        ) => {
          logRouterCall({ method: 'put', url, data })
          if (url.endsWith('/422')) options?.onError?.({ title: 'Required' })
        },
        post: (url: string, data: unknown) => logRouterCall({ method: 'post', url, data }),
        on: () => () => {},
      } as never),
    []
  )
  return <pre data-testid="router-calls">[]</pre>
}

function fixturePage(name: string): PupitrePageProps['page'] {
  const fixture = catalogFixtures[name as keyof typeof catalogFixtures]
  return {
    key: `ct:${String(name)}`,
    kind: 'custom',
    title: String(name),
    breadcrumbs: [],
    spec: fixture,
    state: fixture.state ?? {},
    actions: { header: [] },
    catalogVersion: '0.1',
  }
}

export function FixtureStory({
  name,
  upload = async () => ({}),
}: {
  name: string
  upload?: (field: string, files: File[]) => Promise<unknown>
}) {
  const page = fixturePage(name)
  return (
    <div data-testid="fixture-root">
      <PupitreRenderer
        page={page}
        pupitre={panel}
        registry={registry}
        runAction={async () => {}}
        upload={upload}
        toast={noopToast}
      />
      <RouterLog />
    </div>
  )
}

function RepeaterFixture({
  initialItems = [],
  itemLabel = 'Item',
}: {
  initialItems?: Array<{ _key: string; sku: string }>
  itemLabel?: unknown
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
          props: { descriptor: { name: 'items', minItems: 0, addLabel: 'Add item' } },
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
    catalogVersion: '0.1',
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
    catalogVersion: '0.1',
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
              catalogVersion: '0.1',
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
    catalogVersion: '0.1',
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
  upload?: (field: string, files: File[]) => Promise<unknown>
) {
  const page: PupitrePageProps['page'] = {
    key,
    kind: 'custom',
    title: key,
    breadcrumbs: [],
    spec,
    state,
    actions: { header: [] },
    catalogVersion: '0.1',
  }
  return (
    <div>
      <PupitreRenderer
        page={page}
        pupitre={panel}
        registry={registry}
        runAction={async () => {}}
        upload={upload ?? (async () => ({}))}
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
