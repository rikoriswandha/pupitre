import { test } from '@japa/runner'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { setRouter, type RouterLike } from '../src/bridge/inertia.js'
import { useNavigationGuard, type NavigationGuard } from '../src/hooks/index.js'

type Visit = {
  method: string
  only: string[]
  prefetch: boolean
  url: URL
  preserveScroll?: boolean
}

/**
 * Mirrors Inertia's contract: `before` listeners run synchronously inside
 * `visit`, and any `preventDefault()` cancels the navigation.
 */
function fakeRouter() {
  const listeners: Array<(event: unknown) => void> = []
  const navigated: Array<{ url: string; options: Record<string, unknown> }> = []
  const dispatch = (visit: Visit) => {
    let prevented = false
    const event = { detail: { visit }, preventDefault: () => (prevented = true) }
    for (const listener of listeners) listener(event)
    return !prevented
  }
  const router = {
    on(_type: string, listener: (event: unknown) => void) {
      listeners.push(listener)
      return () => listeners.splice(listeners.indexOf(listener), 1)
    },
    visit(url: URL | string, options: Partial<Visit> = {}) {
      const visit: Visit = {
        method: 'get',
        only: [],
        prefetch: false,
        ...options,
        url: new URL(String(url), 'http://localhost'),
      }
      const extras = { id: 'v1', completed: false, cancelled: false, interrupted: false }
      if (dispatch({ ...visit, ...extras } as Visit)) {
        const { url: target, ...rest } = visit
        navigated.push({ url: target.pathname, options: rest })
      }
    },
  }
  return { router: router as unknown as RouterLike, navigated, listeners }
}

async function mountGuard(shouldBlock: () => boolean) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(document.createElement('div') as unknown as Element)
  let guard: NavigationGuard | undefined
  function Harness() {
    guard = useNavigationGuard(shouldBlock)
    return null
  }
  await act(async () => root.render(<Harness />))
  return { root, current: () => guard! }
}

test.group('useNavigationGuard', () => {
  test('holds a blocked GET visit until proceed re-issues it once with its options', async ({
    assert,
  }) => {
    const fake = fakeRouter()
    const restore = setRouter(fake.router)
    const { root, current } = await mountGuard(() => true)
    try {
      await act(async () => fake.router.visit('/admin/posts', { preserveScroll: true }))
      assert.isTrue(current().pending)
      assert.isEmpty(fake.navigated)
      await act(async () => current().proceed())
      assert.isFalse(current().pending)
      assert.deepEqual(fake.navigated, [
        {
          url: '/admin/posts',
          options: { method: 'get', only: [], prefetch: false, preserveScroll: true },
        },
      ])
    } finally {
      await act(async () => root.unmount())
      restore()
    }
  })

  test('cancel drops the visit and later visits are blocked again', async ({ assert }) => {
    const fake = fakeRouter()
    const restore = setRouter(fake.router)
    const { root, current } = await mountGuard(() => true)
    try {
      await act(async () => fake.router.visit('/admin/posts'))
      await act(async () => current().cancel())
      assert.isFalse(current().pending)
      assert.isEmpty(fake.navigated)
      await act(async () => fake.router.visit('/admin/users'))
      assert.isTrue(current().pending)
      assert.isEmpty(fake.navigated)
    } finally {
      await act(async () => root.unmount())
      restore()
    }
  })

  test('lets clean forms, partial reloads, prefetches and non-GET visits through', async ({
    assert,
  }) => {
    const fake = fakeRouter()
    const restore = setRouter(fake.router)
    let dirty = false
    const { root, current } = await mountGuard(() => dirty)
    try {
      await act(async () => fake.router.visit('/clean'))
      dirty = true
      await act(async () => fake.router.visit('/partial', { only: ['data'] }))
      await act(async () => fake.router.visit('/prefetch', { prefetch: true }))
      await act(async () => fake.router.visit('/posts', { method: 'post' }))
      assert.isFalse(current().pending)
      assert.deepEqual(
        fake.navigated.map((entry) => entry.url),
        ['/clean', '/partial', '/prefetch', '/posts']
      )
    } finally {
      await act(async () => root.unmount())
      restore()
    }
    assert.isEmpty(fake.listeners)
  })
})
