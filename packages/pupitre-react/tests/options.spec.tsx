import { test } from '@japa/runner'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { fetchOptions, setFetch } from '../src/bridge/actions.js'
import { useOptions } from '../src/hooks/use_options.js'
test('fetchOptions sends search, selected values, and page and parses result options', async ({
  assert,
}) => {
  let requested: URL | undefined
  const restoreFetch = setFetch((async (input: RequestInfo | URL) => {
    requested = new URL(String(input), 'http://pupitre.local')
    return new Response(
      JSON.stringify({
        options: [
          { value: 2, label: 'Selected label' },
          { value: 3, label: 'Page two' },
        ],
        hasMore: true,
      })
    )
  }) as typeof fetch)
  try {
    const result = await fetchOptions('/options', { search: 'category', selected: [2], page: 2 })
    assert.equal(requested?.searchParams.get('q'), 'category')
    assert.equal(requested?.searchParams.get('selected[]'), '2')
    assert.equal(requested?.searchParams.get('page'), '2')
    assert.deepEqual(
      result.options.map((option) => option.label),
      ['Selected label', 'Page two']
    )
    assert.isTrue(result.hasMore)
  } finally {
    restoreFetch()
  }
})

test('an empty multi-select value only fetches options once after state updates', async ({
  assert,
}) => {
  const dom = new Window()
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  let requests = 0
  const restoreFetch = setFetch((async () => {
    requests += 1
    return new Response(JSON.stringify({ options: [{ value: 1, label: 'One' }], hasMore: false }))
  }) as typeof fetch)
  function Harness() {
    useOptions({ url: '/options', value: [] })
    return null
  }
  try {
    await act(async () => root.render(<Harness />))
    await act(async () => {
      const wait = Promise.withResolvers<void>()
      setTimeout(wait.resolve, 25)
      await wait.promise
    })
    assert.equal(requests, 1)
  } finally {
    await act(async () => root.unmount())
    restoreFetch()
    dom.happyDOM.abort()
  }
})

test('useOptions debounces search and appends paged results', async ({ assert }) => {
  const dom = new Window()
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const fakeTimers = new Map<number, () => void>()
  let nextTimer = 0
  globalThis.setTimeout = ((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (delay === 250 && typeof callback === 'function') {
      const id = ++nextTimer
      fakeTimers.set(id, () => callback(...args))
      return id as unknown as ReturnType<typeof setTimeout>
    }
    return originalSetTimeout(callback, delay, ...args)
  }) as typeof setTimeout
  globalThis.clearTimeout = ((id?: number | ReturnType<typeof setTimeout>) => {
    if (id !== undefined && fakeTimers.delete(Number(id))) return
    originalClearTimeout(id)
  }) as typeof clearTimeout
  const requests: URL[] = []
  const restoreFetch = setFetch((async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://pupitre.local')
    requests.push(url)
    const page = Number(url.searchParams.get('page'))
    return new Response(
      JSON.stringify({
        options: [{ value: page, label: `Page ${page}` }],
        hasMore: page === 1,
      })
    )
  }) as typeof fetch)
  let current: ReturnType<typeof useOptions> | undefined
  function Harness() {
    current = useOptions({ url: '/options', value: [], debounce: 250 })
    return null
  }
  try {
    await act(async () => root.render(<Harness />))
    await act(async () => {
      const wait = Promise.withResolvers<void>()
      originalSetTimeout(wait.resolve, 10)
      await wait.promise
    })
    assert.equal(requests.length, 1)
    await act(async () => {
      current!.setSearch('culture')
    })
    assert.equal(requests.length, 1)
    const debounceTimer = [...fakeTimers.entries()][0]
    assert.isDefined(debounceTimer)
    fakeTimers.delete(debounceTimer![0])
    await act(async () => {
      debounceTimer![1]()
      const wait = Promise.withResolvers<void>()
      originalSetTimeout(wait.resolve, 10)
      await wait.promise
    })
    assert.equal(requests.length, 2)
    assert.equal(requests[1]?.searchParams.get('q'), 'culture')
    assert.equal(requests[1]?.searchParams.get('page'), '1')
    assert.deepEqual(
      current!.options.map((option) => option.label),
      ['Page 1']
    )
    await act(async () => {
      current!.loadMore()
      const wait = Promise.withResolvers<void>()
      originalSetTimeout(wait.resolve, 10)
      await wait.promise
    })
    assert.equal(requests.length, 3)
    assert.equal(requests[2]?.searchParams.get('page'), '2')
    assert.deepEqual(
      current!.options.map((option) => option.label),
      ['Page 1', 'Page 2']
    )
  } finally {
    await act(async () => root.unmount())
    restoreFetch()
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
    dom.happyDOM.abort()
  }
})
test('preloaded options filter locally and include created options', async ({ assert }) => {
  const dom = new Window()
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  const container = dom.document.createElement('div')
  dom.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  let current: ReturnType<typeof useOptions> | undefined
  function Harness() {
    current = useOptions({
      url: '/options',
      value: ['culture'],
      initial: [
        { value: 'culture', label: 'Culture' },
        { value: 'design', label: 'Design' },
      ],
      preload: true,
    })
    return null
  }
  try {
    await act(async () => root.render(<Harness />))
    assert.deepEqual(
      current!.options.map((option) => option.label),
      ['Culture', 'Design']
    )
    await act(async () => current!.setSearch('design'))
    assert.deepEqual(
      current!.options.map((option) => option.label),
      ['Culture', 'Design']
    )
    await act(async () => {
      current!.addOption({ value: 'new', label: 'New category' })
      current!.setSearch('new')
    })
    assert.deepEqual(
      current!.options.map((option) => option.label),
      ['Culture', 'New category']
    )
  } finally {
    await act(async () => root.unmount())
    dom.happyDOM.abort()
  }
})
