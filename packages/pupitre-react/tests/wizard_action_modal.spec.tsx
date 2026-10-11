import { test } from '@japa/runner'
import { act } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import type { ActionDescriptor, PupitrePageProps } from '@rikology/pupitre/catalog'
import { defineRegistry } from '../src/registry/defineRegistry.js'
import { ActionModal } from '../src/renderer/ActionModal.js'
import { setFetch } from '../src/bridge/actions.js'

function installDom() {
  const dom = new Window()
  const global = globalThis as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries({
    window: dom,
    document: dom.document,
    navigator: dom.navigator,
    Node: dom.Node,
    Element: dom.Element,
    HTMLElement: dom.HTMLElement,
    MutationObserver: dom.MutationObserver,
    Event: dom.Event,
    MouseEvent: dom.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    Object.defineProperty(global, key, { configurable: true, writable: true, value })
  return dom
}
const registry = defineRegistry({
  Shell: ({ children }: { children: ReactNode }) => <>{children}</>,
  Toaster: () => null,
  Modal: ({ children, footer }: { children: ReactNode; footer?: ReactNode }) => (
    <section>
      {children}
      {footer}
    </section>
  ),
  ConfirmDialog: ({
    open,
    heading,
    onConfirm,
    onCancel,
  }: {
    open: boolean
    heading: string
    onConfirm: () => void
    onCancel: () => void
  }) =>
    open ? (
      <div role="dialog">
        <h2>{heading}</h2>
        <button type="button" onClick={onConfirm}>
          Confirm
        </button>
        <button type="button" onClick={onCancel}>
          Cancel confirmation
        </button>
      </div>
    ) : null,
  NotFound: () => null,
  Wizard: () => <div data-testid="wizard-content">Wizard content</div>,
  Step: () => null,
} as never)
const pupitre = {
  panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
  user: null,
  tenant: null,
  nav: [],
  flash: [],
  locale: 'en',
  timezone: 'UTC',
} as unknown as PupitrePageProps['pupitre']
const action: ActionDescriptor = {
  name: 'wizard',
  label: 'Wizard',
  kind: 'form',
  url: '/posts/actions/wizard',
  enabled: true,
  modal: {
    submit: false,
    footerActions: [
      {
        name: 'save-draft',
        label: 'Save draft',
        kind: 'direct',
        url: '/posts/actions/save-draft',
        method: 'post',
        enabled: true,
      },
    ],
  },
}

test('wizard modal retains Next and Back beside footer actions when submit is disabled', async ({
  assert,
}) => {
  const dom = installDom()
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  const restoreFetch = setFetch(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          spec: {
            root: 'wizard',
            elements: {
              'wizard': {
                type: 'Wizard',
                props: {
                  id: 'setup',
                  steps: [
                    { key: 'first', label: 'First' },
                    { key: 'second', label: 'Second' },
                  ],
                },
                children: ['first-step', 'second-step'],
              },
              'first-step': { type: 'Step', props: { name: 'First' }, children: [] },
              'second-step': { type: 'Step', props: { name: 'Second' }, children: [] },
            },
          },
          state: { data: {}, ui: { wizard: { setup: { step: 0 } } } },
          catalogVersion: '1.0',
        }),
      }) as Response
  )
  try {
    await act(async () =>
      root.render(
        <ActionModal
          action={action}
          registry={registry.shell}
          runtimeRegistry={registry}
          pupitre={pupitre}
          close={() => {}}
          toast={() => {}}
          onResult={() => {}}
        />
      )
    )
    const { promise: loaded, resolve: resolveLoaded } = Promise.withResolvers<void>()
    setTimeout(resolveLoaded, 0)
    await act(async () => loaded)
    const buttons = () => Array.from(container.querySelectorAll('button'))
    assert.deepEqual(
      buttons().map((button) => button.textContent),
      ['Cancel', 'Save draft', 'Next']
    )
    await act(async () => buttons()[2]?.click())
    assert.deepEqual(
      buttons().map((button) => button.textContent),
      ['Cancel', 'Back', 'Save draft']
    )
    await act(async () => buttons()[1]?.click())
    assert.deepEqual(
      buttons().map((button) => button.textContent),
      ['Cancel', 'Save draft', 'Next']
    )
  } finally {
    await act(async () => root.unmount())
    restoreFetch()
    dom.happyDOM.abort()
  }
})
test('confirm footer actions ask for confirmation before submitting', async ({ assert }) => {
  const dom = installDom()
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  const submissions: string[] = []
  const confirmAction: ActionDescriptor = {
    ...action,
    modal: {
      footerActions: [
        {
          name: 'delete',
          label: 'Delete records',
          kind: 'confirm',
          url: '/posts/actions/delete',
          enabled: true,
          confirm: { heading: 'Delete selected records?' },
        },
      ],
    },
  }
  const restoreFetch = setFetch(async (_url, init) => {
    if ((init?.method ?? 'GET') === 'GET')
      return {
        ok: true,
        status: 200,
        json: async () => ({
          spec: { root: 'form', elements: { form: { type: 'Form', props: {} } } },
          state: { data: {} },
          catalogVersion: '1.0',
        }),
      } as Response
    submissions.push(String(init?.method))
    return { ok: true, status: 200, json: async () => ({ result: { reload: false } }) } as Response
  })
  try {
    await act(async () =>
      root.render(
        <ActionModal
          action={confirmAction}
          registry={registry.shell}
          runtimeRegistry={registry}
          pupitre={pupitre}
          close={() => {}}
          toast={() => {}}
          onResult={() => {}}
        />
      )
    )
    const { promise, resolve } = Promise.withResolvers<void>()
    setTimeout(resolve, 0)
    await act(async () => promise)
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Delete records')
        ?.click()
    })
    assert.deepEqual(submissions, [])
    assert.equal(
      container.querySelector('[role="dialog"] h2')?.textContent,
      'Delete selected records?'
    )
    await act(async () =>
      (container.querySelector('[role="dialog"] button') as unknown as HTMLButtonElement).click()
    )
    assert.deepEqual(submissions, ['POST'])
  } finally {
    await act(async () => root.unmount())
    restoreFetch()
    dom.happyDOM.abort()
  }
})
