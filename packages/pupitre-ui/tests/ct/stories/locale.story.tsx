import { useEffect, useState } from 'react'
import { setRouter } from '@rikology/pupitre-react'
import { configureI18n } from '../../../../pupitre-react/src/i18n.js'
import { UserMenu } from '../../../src/components/UserMenu.js'
import { ConfirmDialog } from '../../../src/components/ConfirmDialog.js'
import Placeholder from '../../../src/components/Placeholder.js'
import { defineRegistry, PupitreRenderer } from '@rikology/pupitre-react'
import { components } from '../../../src/components.js'
import messages from '../../../../pupitre/src/locales/id.js'

export function LocaleMenuStory({
  locale = 'en',
  single = false,
}: {
  locale?: string
  single?: boolean
}) {
  configureI18n(
    locale,
    locale === 'id' ? { 'Open user menu': 'Buka menu pengguna', 'Language': 'Bahasa' } : undefined
  )
  useEffect(() => {
    const restore = setRouter({
      visit: (url: string, options?: { method?: string; data?: Record<string, unknown> }) => {
        const output = document.querySelector('[data-testid="locale-switch"]')
        if (output) output.textContent = JSON.stringify({ url, ...options })
      },
      reload: () => {},
      put: () => {},
      post: () => {},
      on: () => () => {},
    } as never)
    return () => {
      restore()
      configureI18n('en')
    }
  }, [])
  return (
    <main className="p-8">
      <UserMenu
        panel={
          {
            id: 'locale-menu',
            path: '/admin/acme',
            brand: { name: 'Admin' },
            theme: {},
            features: {},
          } as never
        }
        user={{ id: 1, name: 'Editor', email: 'editor@example.test' }}
        locale={locale}
        locales={single ? [locale] : ['en', 'id']}
      />
      <output data-testid="locale-switch" />
    </main>
  )
}

export function LocaleDefaultsStory() {
  const [loading, setLoading] = useState(false)
  configureI18n('id', {
    'Confirm': 'Konfirmasi',
    'Cancel': 'Batal',
    'No content available': 'Belum ada konten',
    'Working…': 'Memproses…',
  })
  useEffect(() => () => configureI18n('en'), [])
  return (
    <>
      <Placeholder props={{}} />
      <ConfirmDialog
        open
        loading={loading}
        heading="Hapus data?"
        onConfirm={() => setLoading(true)}
        onCancel={() => {}}
      />
    </>
  )
}

const registry = defineRegistry(components)
export function LocaleFormStory() {
  configureI18n('id', { ...messages, 'Item {number}': 'Butir {number}' })
  useEffect(() => () => configureI18n('en'), [])
  return (
    <PupitreRenderer
      page={{
        key: 'ct:localized-form',
        kind: 'custom',
        title: 'Form',
        breadcrumbs: [],
        actions: { header: [] },
        catalogVersion: '1.0',
        spec: {
          root: 'root',
          elements: {
            root: { type: 'Group', props: {}, children: ['password', 'section', 'repeat'] },
            password: {
              type: 'Text',
              props: {
                name: 'password',
                label: 'Kata sandi',
                type: 'password',
                revealable: true,
                value: { $bindState: '/data/password' },
              },
            },
            section: {
              type: 'Section',
              props: {
                heading: 'Rincian',
                collapsible: true,
                collapsed: { $bindState: '/ui/collapsed' },
              },
              children: ['content'],
            },
            content: { type: 'Placeholder', props: { content: 'Isi rincian' } },
            repeat: {
              type: 'Repeater',
              props: { descriptor: { name: 'items', minItems: 0, reorderable: true } },
              repeat: { statePath: '/data/items', key: '_key' },
              children: ['item'],
            },
            item: { type: 'RepeaterItem', props: { index: { $index: true } }, children: ['title'] },
            title: {
              type: 'Text',
              props: { name: 'title', label: 'Judul', value: { $bindItem: 'title' } },
            },
          },
        },
        state: {
          ui: { collapsed: false },
          data: {
            password: 'secret',
            items: [
              { _key: 'one', title: '' },
              { _key: 'two', title: '' },
            ],
          },
        },
      }}
      pupitre={{
        panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
        user: null,
        tenant: null,
        nav: [],
        flash: [],
        locale: 'id',
        timezone: 'UTC',
        messages: { ...messages, 'Item {number}': 'Butir {number}' },
      }}
      registry={registry}
      runAction={async () => {}}
      toast={() => {}}
      upload={async () => ({})}
    />
  )
}
