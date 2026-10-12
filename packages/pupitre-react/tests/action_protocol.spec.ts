import { ActionConfirm } from '../src/renderer/ActionConfirm.js'
import type { ConfirmDialogProps, ShellRegistry } from '../src/shell/types.js'
import { test } from '@japa/runner'
import {
  handleActionResult,
  registerTableSelectionClearer,
  setFetch,
  submitAction,
  waitForExport,
} from '../src/bridge/actions.js'
import { setRouter } from '../src/bridge/inertia.js'
import type { RouterLike } from '../src/bridge/inertia.js'
import type { ActionDescriptor, ActionResult } from '@rikology/pupitre/catalog'
import { ensureCatalogVersion, isSafeNewTabUrl } from '../src/page/Pupitre.js'
import { defineRegistry, getRegistryHandlers } from '../src/registry/defineRegistry.js'
import { exposePupitreDevContext } from '../src/renderer/PupitreRenderer.js'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
function fakeRouter(calls: Array<{ method: string; args: unknown[] }>): RouterLike {
  const record =
    (method: string) =>
    (...args: unknown[]) =>
      calls.push({ method, args })
  return {
    visit: record('visit'),
    reload: record('reload'),
    get: record('get'),
    post: record('post'),
    put: record('put'),
    patch: record('patch'),
    delete: record('delete'),
  } as unknown as RouterLike
}
test('confirm cancellation sends no request and confirmation submits ids', async ({ assert }) => {
  let submissions = 0
  let submittedBody = ''
  let confirmed = false
  let closed = false
  const container = document.createElement('div')
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(container)
  let dialog: ConfirmDialogProps | undefined
  const restoreFetch = setFetch(async (_url, init) => {
    submissions++
    submittedBody = String(init?.body)
    return { status: 200, json: async () => ({ flash: [] }) } as Response
  })
  const props = {
    action: {
      name: 'archive',
      label: 'Archive',
      kind: 'confirm',
      url: '/posts/8',
      method: 'delete',
      enabled: true,
    } as ActionDescriptor,
    ids: [8, 9],
    registry: {
      ConfirmDialog: (next: ConfirmDialogProps) => {
        dialog = next
        return null
      },
    } as unknown as ShellRegistry,
    onResult: () => {
      confirmed = true
    },
    onCancel: () => {
      closed = true
    },
    toast: () => {},
  }
  try {
    await act(async () => root.render(createElement(ActionConfirm, props)))
    if (!dialog) throw new Error('Missing confirmation')
    await act(async () => dialog?.onCancel())
    assert.equal(submissions, 0)
    await act(async () => {
      await dialog?.onConfirm()
    })
    assert.equal(submissions, 1)
    assert.deepEqual(JSON.parse(submittedBody), { ids: [8, 9] })
    assert.isTrue(confirmed)
    assert.isTrue(closed)
  } finally {
    await act(async () => root.unmount())
    restoreFetch()
  }
})
test('catalog mismatch persists its reload guard and toasts on the next mismatch', async ({
  assert,
}) => {
  const version = '912345.0'
  const key = `pupitre:catalog-reloaded:${version}`
  window.sessionStorage.removeItem(key)
  const reload = window.location.reload
  let reloads = 0
  let notice: string | undefined
  Object.defineProperty(window.location, 'reload', {
    configurable: true,
    value: () => reloads++,
  })
  try {
    ensureCatalogVersion(version, (title) => (notice = title))
    assert.equal(reloads, 1)
    assert.equal(window.sessionStorage.getItem(key), '1')
    ensureCatalogVersion(version, (title) => (notice = title))
    assert.equal(reloads, 1)
    assert.equal(notice, 'Reload required')
  } finally {
    window.sessionStorage.removeItem(key)
    Object.defineProperty(window.location, 'reload', { configurable: true, value: reload })
  }
})
test('development context exposure is enabled only by the isDev gate', ({ assert }) => {
  const target = {} as Window
  const context = { store: {} as never, page: {} as never }
  exposePupitreDevContext(target, false, context)
  assert.isUndefined((target as Window & { __pupitre?: unknown }).__pupitre)
  exposePupitreDevContext(target, true, context)
  assert.deepEqual((target as Window & { __pupitre?: unknown }).__pupitre, context)
})
test('registry does not expose unavailable evaluate or fetchOptions actions', ({ assert }) => {
  const { registry } = defineRegistry({} as never)
  const handlers = getRegistryHandlers(registry) as unknown as Record<string, unknown>
  assert.notProperty(handlers, 'evaluate')
  assert.notProperty(handlers, 'fetchOptions')
})
test('new-tab actions allow only HTTP(S) and relative URLs', ({ assert }) => {
  assert.isTrue(isSafeNewTabUrl('https://example.test/path'))
  assert.isTrue(isSafeNewTabUrl('/admin/posts'))
  assert.isTrue(isSafeNewTabUrl('admin/posts'))
  assert.isFalse(isSafeNewTabUrl('javascript:alert(1)'))
  assert.isFalse(isSafeNewTabUrl('data:text/html,unsafe'))
})

test('action submissions consume ActionResult and send selected ids as JSON', async ({
  assert,
}) => {
  let init: RequestInit | undefined
  const location = window as unknown as { happyDOM: { setURL(url: string): void } }
  location.happyDOM.setURL('http://localhost/admin/posts?q=1&action=publish&record=7')
  const restoreFetch = setFetch(async (_input, request) => {
    init = request
    return {
      status: 200,
      json: async () => ({ flash: [{ type: 'success', title: 'Saved' }], patch: [] }),
    } as Response
  })
  try {
    const response = await submitAction('/posts/actions/publish', { ids: [1, 'two'] })
    assert.equal(response.status, 200)
    assert.deepEqual(response.result?.flash, [{ type: 'success', title: 'Saved' }])
    assert.equal(init?.method, 'POST')
    assert.equal((init?.headers as Record<string, string>)['X-Pupitre-Url'], '/admin/posts?q=1')
    assert.equal(init?.credentials, 'same-origin')
    assert.deepEqual(JSON.parse(String(init?.body)), { ids: [1, 'two'] })
  } finally {
    restoreFetch()
    location.happyDOM.setURL('about:blank')
  }
})
test('record delete submissions honor DELETE and include the current page URL', async ({
  assert,
}) => {
  let init: RequestInit | undefined
  const location = window as unknown as { happyDOM: { setURL(url: string): void } }
  location.happyDOM.setURL('http://localhost/admin/posts/3/edit?page=2')
  const restoreFetch = setFetch(async (_input, request) => {
    init = request
    return { status: 200, json: async () => ({ flash: [] }) } as Response
  })
  try {
    await submitAction('/admin/posts/3', { ids: [3] }, 'delete')
    assert.equal(init?.method, 'DELETE')
    assert.equal(
      (init?.headers as Record<string, string>)['X-Pupitre-Url'],
      '/admin/posts/3/edit?page=2'
    )
  } finally {
    restoreFetch()
    location.happyDOM.setURL('about:blank')
  }
})

test('ActionResult patch refreshes top-level data, redirects navigate, and deselect clears selection', ({
  assert,
}) => {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const restoreRouter = setRouter(fakeRouter(calls))
  let selected = true
  const unregister = registerTableSelectionClearer(() => {
    selected = false
  })
  const toasts: string[] = []
  let data: unknown = { rows: [{ id: 1 }], query: {} }
  try {
    const result: ActionResult = {
      flash: [{ type: 'success', title: 'Updated' }],
      patch: [{ op: 'replace', path: '/rows', value: [{ id: 2 }] }],
      deselect: true,
    }
    handleActionResult(result, {
      data,
      pageKind: 'list',
      toast: (message) => toasts.push(message.title),
      setData: (next) => {
        data = next
      },
    })
    assert.deepEqual(data, { rows: [{ id: 2 }], query: {} })
    assert.deepEqual(toasts, ['Updated'])
    assert.isFalse(selected)
    assert.equal(calls[0]?.method, 'reload')
    assert.deepEqual(calls[0]?.args[0], { only: ['data'] })

    handleActionResult(
      { flash: [], redirect: 'http://localhost/posts/2' },
      {
        data,
        pageKind: 'list',
        toast: () => {},
        setData: () => {},
      }
    )
    assert.equal(calls[1]?.method, 'visit')
    assert.equal(calls[1]?.args[0], 'http://localhost/posts/2')
    handleActionResult(
      { flash: [], reload: true },
      { data, pageKind: 'list', toast: () => {}, setData: () => {} }
    )
    assert.deepEqual(calls[2]?.args[0], { only: ['data'] })
    handleActionResult(
      { flash: [], reload: true },
      { data, pageKind: 'view', toast: () => {}, setData: () => {} }
    )
    assert.equal(calls[3]?.method, 'reload')
    assert.isUndefined(calls[3]?.args[0])
  } finally {
    unregister()
    restoreRouter()
  }
})
test('export polling aborts between progress checks', async ({ assert }) => {
  let requests = 0
  const restoreFetch = setFetch(async () => {
    requests++
    return new Response(
      JSON.stringify({
        id: 'export-1',
        status: 'queued',
        totalRows: 1,
        processedRows: 0,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  })
  const controller = new AbortController()
  try {
    const polling = waitForExport({ progressUrl: '/exports/1' }, undefined, {
      signal: controller.signal,
    })
    setTimeout(() => controller.abort(), 10)
    await assert.rejects(() => polling, /cancel|abort/i)
    assert.equal(requests, 1)
  } finally {
    controller.abort()
    restoreFetch()
  }
})
