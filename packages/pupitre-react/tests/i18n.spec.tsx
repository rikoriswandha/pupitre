import { test } from '@japa/runner'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { Window } from 'happy-dom'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import { configureI18n, t } from '../src/i18n.js'
import { PupitreContent } from '../src/page/Pupitre.js'
import { defineRegistry } from '../src/registry/defineRegistry.js'
import type { AuthShellProps, ShellProps } from '../src/shell/types.js'

const messages = {
  'Hello {name}': 'Halo {name}',
  '{count} items': { one: '{count} item', other: '{count} items', zero: 'No items' },
  'Not found': 'Tidak ditemukan',
}

const registry = defineRegistry({
  Shell: ({ children }: ShellProps) => <main>{children}</main>,
  AuthShell: ({ children }: AuthShellProps) => <main>{children}</main>,
  Toaster: () => null,
  Modal: () => null,
  ConfirmDialog: () => null,
  NotFound: () => <p>{t('Hello {name}', { name: 'Reader' })}</p>,
} as never)

function page(locale: string, dictionary?: typeof messages): PupitrePageProps {
  return {
    pupitre: {
      panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
      user: null,
      tenant: null,
      nav: [],
      flash: [],
      locale,
      messages: dictionary,
      locales: ['en', 'id'],
      timezone: 'UTC',
    },
    page: {
      key: 'admin:missing',
      kind: 'custom',
      title: 'Missing',
      breadcrumbs: [],
      catalogVersion: '1.0',
    },
  } as unknown as PupitrePageProps
}

test('client translations interpolate own parameters and preserve missing source text', ({
  assert,
}) => {
  try {
    configureI18n('id', messages)
    assert.equal(t('Hello {name}', { name: 'Ada' }), 'Halo Ada')
    assert.equal(t('Hello {name}'), 'Halo {name}')
    assert.equal(t('Missing {count}', { count: 0 }), 'Missing 0')
    assert.equal(t('Unknown {name}', { name: '$& {count}', count: 9 }), 'Unknown $& {count}')
    assert.equal(t('toString'), 'toString')
    assert.equal(t('Unknown {name}', Object.create({ name: 'Inherited' })), 'Unknown {name}')
    configureI18n('en')
    assert.equal(t('Hello {name}', { name: 'Ada' }), 'Hello Ada')
  } finally {
    configureI18n('en')
  }
})

test('client plural messages use the active locale and an explicit zero variant', ({ assert }) => {
  try {
    configureI18n('en', messages)
    assert.equal(t('{count} items', { count: 0 }), 'No items')
    assert.equal(t('{count} items', { count: 1 }), '1 item')
    assert.equal(t('{count} items', { count: '1' }), '1 item')
    assert.equal(t('{count} items', { count: 2 }), '2 items')
    configureI18n('id', messages)
    assert.equal(t('{count} items', { count: 1 }), '1 items')
    configureI18n('en', { '{count} items': { one: 'Single', other: 'Multiple' } })
    assert.equal(t('{count} items', { count: 0 }), 'Multiple')
    assert.equal(t('{count} items'), 'Multiple')
  } finally {
    configureI18n('en')
  }
})

test('page rendering translates synchronously during SSR and resets the source locale', ({
  assert,
}) => {
  try {
    assert.include(
      renderToString(<PupitreContent registry={registry} props={page('id', messages)} />),
      'Halo Reader'
    )
    assert.include(
      renderToString(<PupitreContent registry={registry} props={page('en')} />),
      'Hello Reader'
    )
  } finally {
    configureI18n('en')
  }
})

test('Inertia locale updates refresh rendered messages and the document language', async ({
  assert,
}) => {
  const dom = new Window()
  Object.assign(globalThis, { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true })
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  try {
    await act(async () =>
      root.render(<PupitreContent registry={registry} props={page('id', messages)} />)
    )
    assert.equal(container.textContent, 'Halo Reader')
    assert.equal(dom.document.documentElement.lang, 'id')
    await act(async () => root.render(<PupitreContent registry={registry} props={page('en')} />))
    assert.equal(container.textContent, 'Hello Reader')
    assert.equal(dom.document.documentElement.lang, 'en')
  } finally {
    await act(async () => root.unmount())
    dom.happyDOM.abort()
    configureI18n('en')
  }
})
