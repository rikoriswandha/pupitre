import { test } from '@japa/runner'
import { act } from 'react'
import {
  click,
  clearMounts,
  clearRepeatedItemMounts,
  mountHarness,
  mountCount,
  repeatedItemMountCount,
} from './_harness.js'

const item = (id: string) => ({
  type: 'RepeaterItem',
  props: { index: { $index: true }, itemKey: { $item: '_key' } },
  children: [`sku-${id}`, `qty-${id}`, `subtotal-${id}`, `remove-${id}`, `visible-${id}`],
})

function spec() {
  return {
    root: 'form',
    state: {
      data: {
        items: [
          { _key: 'a', sku: 'A', qty: 1, price: 10, variants: [{ _key: 'v1', label: 'small' }] },
          { _key: 'b', sku: 'B', qty: 2, price: 5, variants: [] },
        ],
      },
      errors: { items: [{ sku: 'Required' }, {}] },
      ui: { repeater: { items: { a: { collapsed: false }, b: { collapsed: true } } } },
    },
    elements: {
      'form': { type: 'Form', props: {}, children: ['rep', 'add'] },
      'rep': {
        type: 'Repeater',
        props: {},
        repeat: { statePath: '/data/items', key: '_key' },
        children: ['template'],
      },
      'template': item('template'),
      'visible-template': {
        type: 'Visibility',
        props: { name: 'visible-a' },
        visible: { $item: 'sku', eq: 'A' },
      },
      'add': {
        type: 'Button',
        props: { name: 'add', label: 'Add' },
        on: {
          press: [
            {
              action: 'pushState',
              params: {
                statePath: '/data/items',
                value: { _key: '$id', sku: '', qty: 1, price: 0 },
              },
            },
          ],
        },
      },
      'remove-template': {
        type: 'Button',
        props: { name: 'remove', label: 'Remove', index: { $index: true } },
        on: {
          press: [
            {
              action: 'removeState',
              params: { statePath: '/data/items', index: { $index: true } },
            },
          ],
        },
      },
      'sku-template': {
        type: 'Text',
        props: {
          name: 'sku',
          value: { $bindItem: 'sku' },
          error: { $state: '/errors/items/0/sku' },
        },
      },
      'qty-template': { type: 'Number', props: { name: 'qty', value: { $bindItem: 'qty' } } },
      'subtotal-template': {
        type: 'Placeholder',
        props: {
          content: { $computed: 'mul', args: { a: { $item: 'qty' }, b: { $item: 'price' } } },
        },
      },
    },
  }
}
type RepeaterItem = {
  _key: string
  sku: string
  qty: number
  price: number
  variants?: { _key: string; label: string }[]
}

function readItems(value: unknown): RepeaterItem[] {
  if (!Array.isArray(value)) throw new Error('Expected repeater items array')
  return value as RepeaterItem[]
}

test.group('M0 K1 repeater', () => {
  test('binds absolute item paths, computes subtotal, and preserves form identity as state changes', async ({
    assert,
  }) => {
    clearMounts()
    const view = mountHarness(spec())
    try {
      assert.equal(view.container.querySelectorAll('[data-testid^="item-"]').length, 2)
      assert.equal(view.container.querySelectorAll('[data-testid="visible-a"]').length, 1)
      assert.equal(
        view.container.querySelector('[aria-label="sku"]')?.getAttribute('data-path'),
        '/data/items/0/sku'
      )
      assert.equal(
        view.container.querySelectorAll('[data-testid="subtotal"]')[0]?.textContent,
        '10'
      )
      act(() => view.store.store.set('/data/items/0/qty', 3))
      assert.equal(view.store.store.get('/data/items/0/qty'), 3)
      assert.equal(
        view.container.querySelectorAll('[data-testid="subtotal"]')[0]?.textContent,
        '30'
      )
      assert.equal(mountCount('Form'), 1)
      assert.equal(
        view.container
          .querySelector('[aria-label="sku"]')
          ?.closest('label')
          ?.querySelector('[role="alert"]')?.textContent,
        'Required'
      )
      assert.equal(view.container.querySelectorAll('[role="alert"]').length, 1)
    } finally {
      view.unmount()
    }
  })

  test('push and remove mutate target item without losing retained item values', async ({
    assert,
  }) => {
    const view = mountHarness(spec())
    try {
      const addButton = view.container.querySelector('[data-testid="button-add-global"]')
      if (!addButton) throw new Error('Missing add button')
      click(addButton as unknown as HTMLElement)
      const items = readItems(view.store.store.get('/data/items'))
      assert.equal(items.length, 3)
      assert.equal(typeof items[2]?.['_key'], 'string')
      assert.equal(view.store.store.get('/data/items/0/sku'), 'A')
      const removeButton = view.container.querySelector('[data-testid="button-remove-0"]')
      if (!removeButton) throw new Error('Missing first-item remove button')
      click(removeButton as unknown as HTMLElement)
      assert.equal(view.store.store.get('/data/items/0/sku'), 'B')
      assert.equal(readItems(view.store.store.get('/data/items')).length, 2)
      assert.equal(view.store.store.get('/data/items/1/sku'), '')
      assert.equal(view.container.querySelectorAll('[data-testid^="item-"]').length, 2)
    } finally {
      view.unmount()
    }
  })

  test('nested repeater bindings and item visibility/index expressions resolve', async ({
    assert,
  }) => {
    const nestedSpec = {
      root: 'outer',
      state: {
        data: { items: [{ _key: 'a', sku: 'A', variants: [{ _key: 'v', label: 'small' }] }] },
      },
      elements: {
        'outer': {
          type: 'Repeater',
          props: {},
          repeat: { statePath: '/data/items', key: '_key' },
          children: ['row'],
        },
        'row': {
          type: 'RepeaterItem',
          props: { index: { $index: true }, itemKey: { $item: '_key' } },
          children: ['visible', 'index-visible', 'inner', 'nested-add'],
        },
        'visible': {
          type: 'Visibility',
          props: { name: 'row-visible' },
          visible: { $item: 'sku', eq: 'A' },
        },
        'index-visible': {
          type: 'Visibility',
          props: { name: 'first-index' },
          visible: { $index: true, eq: 0 },
        },
        'nested-add': {
          type: 'Button',
          props: { name: 'nested-add', label: 'Add variant', index: { $index: true } },
          on: {
            press: [
              {
                action: 'pushState',
                params: {
                  statePath: { $item: 'variants' },
                  value: { _key: '$id', label: 'large' },
                },
              },
            ],
          },
        },
        'inner': {
          type: 'Repeater',
          props: {},
          repeat: { statePath: { $item: 'variants' }, key: '_key' },
          children: ['variant'],
        },
        'variant': {
          type: 'RepeaterItem',
          props: { index: { $index: true } },
          children: ['label'],
        },
        'label': { type: 'Text', props: { name: 'label', value: { $bindItem: 'label' } } },
      },
    }
    const view = mountHarness(nestedSpec)
    try {
      assert.equal(
        view.container.querySelector('[aria-label="label"]')?.getAttribute('data-path'),
        '/data/items/0/variants/0/label'
      )
      assert.ok(view.container.querySelector('[data-testid="row-visible"]'))
      assert.ok(view.container.querySelector('[data-testid="first-index"]'))
      const addVariant = view.container.querySelector('[data-testid="button-nested-add-0"]')
      if (!addVariant) throw new Error('Missing nested repeater add button')
      click(addVariant as unknown as HTMLElement)
      assert.equal(readItems(view.store.store.get('/data/items/0/variants')).length, 2)
      assert.equal(view.store.store.get('/ui/repeater/items/a/collapsed'), undefined)
    } finally {
      view.unmount()
    }
  })

  test('reordering keeps repeat-key identity and collapsed data remains keyed by item key', async ({
    assert,
  }) => {
    clearRepeatedItemMounts()
    const view = mountHarness(spec())
    try {
      const items = readItems(view.store.store.get('/data/items'))
      act(() => view.store.store.set('/data/items', [...items].reverse()))
      assert.equal(view.store.store.get('/data/items/0/sku'), 'B')
      assert.equal(view.store.store.get('/data/items/1/sku'), 'A')
      assert.equal(view.store.store.get('/ui/repeater/items/a/collapsed'), false)
      assert.equal(view.store.store.get('/ui/repeater/items/b/collapsed'), true)
      const firstSku = view.container.querySelector(
        '[aria-label="sku"]'
      ) as unknown as HTMLInputElement | null
      assert.equal(firstSku?.value, 'B')
      assert.equal(repeatedItemMountCount('a'), 1)
      assert.equal(repeatedItemMountCount('b'), 1)
    } finally {
      view.unmount()
    }
  })
})
