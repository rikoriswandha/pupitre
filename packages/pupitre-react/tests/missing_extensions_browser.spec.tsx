import { test } from '@japa/runner'
import { Component, act } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import type {
  ActionDescriptor,
  ActionFormResponse,
  PupitrePageProps,
} from '@rikology/pupitre/catalog'
import { defineRegistry } from '../src/registry/defineRegistry.js'
import { PupitreRenderer } from '../src/renderer/PupitreRenderer.js'
import { ActionModal } from '../src/renderer/ActionModal.js'
import { setFetch } from '../src/bridge/actions.js'

class ConfigurationBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    return this.state.error ? (
      <div role="alert">{this.state.error.message}</div>
    ) : (
      this.props.children
    )
  }
}
const pupitre = {
  panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
  user: null,
  tenant: null,
  nav: [],
  flash: [],
  locale: 'en',
  timezone: 'UTC',
} as PupitrePageProps['pupitre']
const registry = defineRegistry({
  Fragment: ({ children }: { children: ReactNode }) => <>{children}</>,
  DataTable: () => <div data-testid="rendered-table">Table</div>,
  RepeatableEntry: () => <div data-testid="rendered-entry">Entry</div>,
  Select: () => <div data-testid="rendered-select">Select</div>,
  Modal: ({ children }: { children: ReactNode }) => <section>{children}</section>,
} as never)
const specs: Record<string, ActionFormResponse['spec']> = {
  field: {
    root: 'field',
    elements: { field: { type: 'MissingExtensionField', props: { name: 'score', value: 3 } } },
  },
  column: {
    root: 'table',
    elements: {
      table: {
        type: 'DataTable',
        props: {
          columns: [
            { name: 'score', type: 'custom', component: 'MissingExtensionColumn', props: {} },
          ],
        },
      },
    },
  },
  entry: {
    root: 'list',
    elements: {
      list: {
        type: 'Fragment',
        props: {
          nested: {
            $raw: {
              root: 'entry',
              elements: { entry: { type: 'MissingExtensionEntry', props: { value: 3 } } },
            },
          },
        },
      },
    },
  },
  repeatable: {
    root: 'list',
    elements: {
      list: {
        type: 'RepeatableEntry',
        props: { entries: [{ name: 'score', component: 'MissingExtensionRepeatable', props: {} }] },
      },
    },
  },
}
function installDom() {
  const dom = new Window()
  for (const [key, value] of Object.entries({
    window: dom,
    document: dom.document,
    navigator: dom.navigator,
    Node: dom.Node,
    Element: dom.Element,
    HTMLElement: dom.HTMLElement,
    MutationObserver: dom.MutationObserver,
    Event: dom.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  return dom
}
for (const [kind, spec] of Object.entries(specs)) {
  for (const modal of [false, true]) {
    test(`browser render fails loudly for an unregistered extension ${kind}${modal ? ' inside an action modal' : ''}`, async ({
      assert,
    }) => {
      const dom = installDom()
      const container = dom.document.createElement('div')
      dom.document.body.append(container)
      const root = createRoot(container as unknown as Element)
      const response: ActionFormResponse = { spec, state: {}, catalogVersion: '1.0' }
      const restore = setFetch(
        async () => ({ ok: true, status: 200, json: async () => response }) as Response
      )
      const page: PupitrePageProps['page'] = {
        ...response,
        key: 'missing-extension',
        kind: 'custom',
        title: '',
        breadcrumbs: [],
        actions: { header: [] },
      }
      try {
        await act(async () =>
          root.render(
            <ConfigurationBoundary>
              {modal ? (
                <ActionModal
                  action={
                    {
                      name: 'rate',
                      kind: 'form',
                      label: 'Rate',
                      url: '/rate',
                      enabled: true,
                    } as ActionDescriptor
                  }
                  registry={registry.shell}
                  runtimeRegistry={registry}
                  pupitre={pupitre}
                  close={() => {}}
                  toast={() => {}}
                  onResult={() => {}}
                />
              ) : (
                <PupitreRenderer
                  page={page}
                  registry={registry}
                  pupitre={pupitre}
                  runAction={async () => {}}
                  upload={async () => ({})}
                  toast={() => {}}
                />
              )}
            </ConfigurationBoundary>
          )
        )
        await act(async () => {
          const { promise, resolve } = Promise.withResolvers<void>()
          setTimeout(resolve, 0)
          await promise
        })
        assert.match(
          container.querySelector('[role="alert"]')?.textContent ?? '',
          new RegExp(
            `MissingExtension${kind[0]!.toUpperCase()}${kind.slice(1)}.*not registered.*defineRegistry`
          )
        )
        assert.isNull(container.querySelector('[data-testid="rendered-table"]'))
      } finally {
        await act(async () => root.unmount())
        restore()
        await dom.happyDOM.abort()
      }
    })
  }
}

test('browser action modal checks response requirements even when the component is descriptor-only', async ({
  assert,
}) => {
  const dom = installDom()
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  const restore = setFetch(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          spec: { root: 'root', elements: { root: { type: 'Fragment', props: {} } } },
          state: {},
          catalogVersion: '1.0',
          catalogExtensions: [{ name: 'host-only', components: ['DescriptorOnlyColumn'] }],
        }),
      }) as Response
  )
  try {
    await act(async () =>
      root.render(
        <ConfigurationBoundary>
          <ActionModal
            action={
              {
                name: 'rate',
                kind: 'form',
                label: 'Rate',
                url: '/rate',
                enabled: true,
              } as ActionDescriptor
            }
            registry={registry.shell}
            runtimeRegistry={registry}
            pupitre={pupitre}
            close={() => {}}
            toast={() => {}}
            onResult={() => {}}
          />
        </ConfigurationBoundary>
      )
    )
    await act(async () => {
      const { promise, resolve } = Promise.withResolvers<void>()
      setTimeout(resolve, 0)
      await promise
    })
    assert.match(
      container.querySelector('[role="alert"]')?.textContent ?? '',
      /DescriptorOnlyColumn.*host-only.*defineRegistry/
    )
  } finally {
    await act(async () => root.unmount())
    restore()
    await dom.happyDOM.abort()
  }
})

test('browser page fails loudly before rendering a Select with an unregistered create-option form extension', async ({
  assert,
}) => {
  const dom = installDom()
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  try {
    await act(async () =>
      root.render(
        <ConfigurationBoundary>
          <PupitreRenderer
            page={{
              key: 'create-option-extension',
              kind: 'create',
              title: '',
              breadcrumbs: [],
              actions: { header: [] },
              state: {},
              catalogVersion: '1.0',
              catalogExtensions: [{ name: 'host-only', components: ['CreateOptionOnlyField'] }],
              spec: {
                root: 'select',
                elements: {
                  select: {
                    type: 'Select',
                    props: { name: 'categoryId', createOption: { url: '/options/categoryId' } },
                  },
                },
              },
            }}
            registry={registry}
            pupitre={pupitre}
            runAction={async () => {}}
            upload={async () => ({})}
            toast={() => {}}
          />
        </ConfigurationBoundary>
      )
    )
    assert.match(
      container.querySelector('[role="alert"]')?.textContent ?? '',
      /CreateOptionOnlyField.*not registered.*defineRegistry/
    )
    assert.isNull(container.querySelector('[data-testid="rendered-select"]'))
  } finally {
    await act(async () => root.unmount())
    await dom.happyDOM.abort()
  }
})
