import { test } from '@japa/runner'
import { act } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import type { ActionDescriptor, PupitrePageProps } from '@rikology/pupitre/catalog'
import { PupitreContent } from '../src/page/Pupitre.js'
import { defineRegistry } from '../src/registry/defineRegistry.js'
import { useRunAction } from '../src/hooks/index.js'
import { setRouter } from '../src/bridge/inertia.js'
import type { RouterLike } from '../src/bridge/inertia.js'
import type { ShellProps } from '../src/shell/types.js'

function HeaderShell({ headerActions, children }: ShellProps & { children: ReactNode }) {
  const runAction = useRunAction()
  return (
    <div>
      {headerActions.map((action) => (
        <button key={action.name} type="button" onClick={() => runAction(action)}>
          {action.label}
        </button>
      ))}
      {children}
    </div>
  )
}

const registry = defineRegistry({
  Shell: HeaderShell,
  Toaster: () => null,
  Modal: () => null,
  ConfirmDialog: () => null,
  NotFound: () => null,
  Form: ({ children }: { children?: ReactNode }) => <form>{children}</form>,
} as never)

const create: ActionDescriptor = {
  name: 'create',
  label: 'New post',
  kind: 'link',
  url: '/admin/posts/create',
  enabled: true,
}

const props = {
  pupitre: {
    panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
    user: null,
    tenant: null,
    nav: [],
    flash: [],
    locale: 'en',
    timezone: 'UTC',
  },
  page: {
    key: 'admin:posts:list::',
    kind: 'list',
    title: 'Posts',
    breadcrumbs: [],
    spec: { root: 'form', elements: { form: { type: 'Form', props: {} } } },
    state: {},
    actions: { header: [create] },
    catalogVersion: '0.2',
  },
} as unknown as PupitrePageProps

test('custom page specs render in the standard shell', async ({ assert }) => {
  const dom = new Window()
  Object.assign(globalThis, { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true })
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  const customProps = {
    ...props,
    page: { ...props.page, kind: 'custom' as const, component: 'admin/Reports' },
  } as unknown as PupitrePageProps
  try {
    await act(async () => root.render(<PupitreContent registry={registry} props={customProps} />))
    assert.isNotNull(container.querySelector('form'))
  } finally {
    await act(async () => root.unmount())
    dom.happyDOM.abort()
  }
})
test('shell header actions run outside the spec renderer store', async ({ assert }) => {
  const dom = new Window()
  Object.assign(globalThis, { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true })
  const visits: string[] = []
  const restoreRouter = setRouter({
    visit: (url: string) => visits.push(url),
    reload: () => {},
  } as unknown as RouterLike)
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  try {
    await act(async () => root.render(<PupitreContent registry={registry} props={props} />))
    const button = container.querySelector('button') as unknown as HTMLButtonElement
    await act(async () => button.click())
    assert.deepEqual(visits, ['/admin/posts/create'])
  } finally {
    await act(async () => root.unmount())
    restoreRouter()
    dom.happyDOM.abort()
  }
})
