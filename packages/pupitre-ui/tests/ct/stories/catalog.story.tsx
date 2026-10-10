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
        put: (url: string, data: unknown) => logRouterCall({ method: 'put', url, data }),
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

function RepeaterFixture() {
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
          props: { index: { $index: true }, itemLabel: 'Item' },
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
    state: { data: { items: [] } },
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
