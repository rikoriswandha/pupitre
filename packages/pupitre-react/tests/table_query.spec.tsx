import { test } from '@japa/runner'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useTable } from '../src/hooks/index.js'
import { setRouter } from '../src/bridge/inertia.js'
import type { TableDescriptor } from '@rikology/pupitre/catalog'
import type { RouterLike } from '../src/bridge/inertia.js'

test('query rules serialize as one prefixed URL value and multi-sort preserves priority and clears defaults', async ({
  assert,
}) => {
  const location = window as unknown as { happyDOM: { setURL(url: string): void } }
  location.happyDOM.setURL('http://localhost/posts?q=keep&comments[page]=4')
  const calls: string[] = []
  const restore = setRouter({
    visit: (url: string) => {
      calls.push(url)
      location.happyDOM.setURL(`http://localhost${url}`)
    },
  } as RouterLike)
  const descriptor = {
    id: 'comments',
    queryPrefix: 'comments',
    dataProp: 'commentsData',
    filters: [{ name: 'query', type: 'queryBuilder' }],
    multiSort: 2,
    defaultSorts: [{ column: 'title', direction: 'asc' }],
  } as TableDescriptor
  let controls: {
    sorts: string[]
    setFilter(name: string, value: unknown): void
    sort(column: string, additive?: boolean): void
    clearSort(): void
  }
  const root = createRoot(document.createElement('div'))
  function Consumer() {
    controls = useTable(descriptor)
    return <output>{controls.sorts.join(',')}</output>
  }
  try {
    await act(async () => root.render(<Consumer />))
    const rules = { groups: [[{ constraint: 'price', operator: 'between', value: [10, 20] }]] }
    await act(async () => controls.setFilter('query', rules))
    let url = new URL(calls.at(-1)!, 'http://localhost')
    assert.deepEqual(JSON.parse(url.searchParams.get('comments[filters][query]')!), rules)
    assert.equal(url.searchParams.get('q'), 'keep')
    assert.isFalse(url.searchParams.has('comments[page]'))
    await act(async () => controls.sort('price', true))
    assert.equal(
      new URL(calls.at(-1)!, 'http://localhost').searchParams.get('comments[sort]'),
      'title,price'
    )
    await act(async () => root.render(<Consumer />))
    await act(async () => controls.sort('price', true))
    assert.equal(
      new URL(calls.at(-1)!, 'http://localhost').searchParams.get('comments[sort]'),
      'title,-price'
    )
    await act(async () => controls.clearSort())
    await act(async () => root.render(<Consumer />))
    assert.deepEqual(controls!.sorts, [])
    url = new URL(calls.at(-1)!, 'http://localhost')
    assert.equal(url.searchParams.get('comments[sort]'), '')
    await act(async () => controls.setFilter('query', ''))
    assert.isFalse(
      new URL(calls.at(-1)!, 'http://localhost').searchParams.has('comments[filters][query]')
    )
  } finally {
    await act(async () => root.unmount())
    restore()
    location.happyDOM.setURL('about:blank')
  }
})
