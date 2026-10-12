import { test } from '@japa/runner'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { setFetch } from '../src/bridge/actions.js'
import { useOptions } from '../src/hooks/use_options.js'
import { ActionModal } from '../src/renderer/ActionModal.js'
import { defineRegistry } from '../src/registry/defineRegistry.js'
import { configureI18n, t } from '../src/i18n.js'
import { ActionConfirm } from '../src/renderer/ActionConfirm.js'
import type { ConfirmDialogProps, ShellRegistry } from '../src/shell/types.js'

test('option and action form failures use the active dictionary and close the failed modal', async ({
  assert,
}) => {
  const dom = new Window()
  Object.assign(globalThis, { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true })
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  const restoreFetch = setFetch(async () => {
    throw 'offline'
  })
  configureI18n('id', {
    'Unable to load options': 'Gagal memuat pilihan',
    'Unable to load action form.': 'Gagal memuat formulir aksi.',
  })
  const toasts: string[] = []
  let closed = 0
  const registry = defineRegistry({ Modal: () => null } as never)
  function Options() {
    const options = useOptions({ url: '/options', value: null })
    return <output>{options.error}</output>
  }
  try {
    await act(async () =>
      root.render(
        <>
          <Options />
          <ActionModal
            action={{ name: 'edit', label: 'Edit', kind: 'form', url: '/action', enabled: true }}
            registry={registry.shell}
            runtimeRegistry={registry}
            pupitre={{
              panel: {
                id: 'admin',
                path: '/admin',
                brand: { name: 'Admin' },
                theme: {},
                features: {},
              },
              user: null,
              tenant: null,
              nav: [],
              flash: [],
              locale: 'id',
              timezone: 'UTC',
            }}
            close={() => {
              closed += 1
            }}
            toast={(message) => toasts.push(message.title)}
            onResult={() => {}}
          />
        </>
      )
    )
    await act(async () => {
      const { promise, resolve } = Promise.withResolvers<void>()
      setTimeout(resolve, 10)
      await promise
    })
    assert.equal(container.querySelector('output')?.textContent, 'Gagal memuat pilihan')
    assert.deepEqual(toasts, ['Gagal memuat formulir aksi.'])
    assert.equal(closed, 1)
  } finally {
    await act(async () => root.unmount())
    restoreFetch()
    configureI18n('en')
    dom.happyDOM.abort()
  }
})

test('delete confirmation exposes translated working state for the entire pending request', async ({
  assert,
}) => {
  const dom = new Window()
  Object.assign(globalThis, { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true })
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  const pending = Promise.withResolvers<Response>()
  const restoreFetch = setFetch(() => pending.promise)
  configureI18n('id', { 'Working…': 'Memproses…' })
  let completed = false
  const ConfirmDialog = ({ loading, onConfirm }: ConfirmDialogProps) => (
    <button disabled={loading} onClick={onConfirm}>
      {loading ? t('Working…') : 'Hapus'}
    </button>
  )
  try {
    await act(async () =>
      root.render(
        <ActionConfirm
          action={{
            name: 'delete',
            label: 'Hapus',
            kind: 'confirm',
            url: '/posts/1',
            method: 'delete',
            enabled: true,
          }}
          registry={{ ConfirmDialog } as ShellRegistry}
          toast={() => {}}
          onResult={() => {
            completed = true
          }}
          onCancel={() => {}}
        />
      )
    )
    const button = container.querySelector('button')
    assert.exists(button)
    await act(async () => button?.click())
    assert.equal(button?.textContent, 'Memproses…')
    assert.isTrue(button?.disabled)
    assert.isFalse(completed)
    await act(async () => {
      pending.resolve(
        new Response(JSON.stringify({ flash: [], reload: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    assert.isTrue(completed)
    assert.isFalse(button?.disabled)
  } finally {
    await act(async () => root.unmount())
    restoreFetch()
    configureI18n('en')
    dom.happyDOM.abort()
  }
})
