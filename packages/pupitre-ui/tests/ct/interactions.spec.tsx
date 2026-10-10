import { test, expect } from '@playwright/experimental-ct-react'
import { catalogFixtures } from '@rikology/pupitre/catalog'
import { components } from '../../src/components.js'
import { defineRegistry, PupitreRenderer } from '@rikology/pupitre-react'
import { Modal } from '../../src/components/Modal.js'

const registry = defineRegistry(components)
const panel = {
  panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
  user: null,
  tenant: null,
  nav: [],
  flash: [],
  locale: 'en',
  timezone: 'UTC',
} as const

function Fixture({
  name,
  upload = async () => ({}),
}: {
  name: keyof typeof catalogFixtures
  upload?: (field: string, files: File[]) => Promise<unknown>
}) {
  const fixture = catalogFixtures[name]
  const page = {
    key: `interaction:${name}`,
    kind: 'custom' as const,
    title: String(name),
    breadcrumbs: [],
    spec: fixture,
    state: fixture.state ?? {},
    actions: { header: [] },
    catalogVersion: '0.1',
  }
  return (
    <PupitreRenderer
      page={page}
      pupitre={panel}
      registry={registry}
      runAction={async () => {}}
      submitForm={() => {}}
      upload={upload}
      toast={() => {}}
    />
  )
}

function OpenModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal open heading="Modal title" onClose={onClose}>
      <p>Modal content</p>
    </Modal>
  )
}

function RepeaterRuntime() {
  const page = {
    key: 'interaction:repeater',
    kind: 'custom' as const,
    title: 'Repeater',
    breadcrumbs: [],
    spec: {
      root: 'repeat',
      state: {
        data: {
          items: [
            { _key: 'one', sku: 'First' },
            { _key: 'two', sku: 'Second' },
          ],
        },
      },
      elements: {
        repeat: {
          type: 'Repeater',
          props: { descriptor: { name: 'items', minItems: 0, addLabel: 'Add item' } },
          repeat: { statePath: '/data/items', key: '_key' },
          children: ['item'],
          on: {
            add: [
              {
                action: 'pushState',
                params: { statePath: '/data/items', value: { _key: '$id', sku: '' } },
              },
            ],
          },
        },
        item: {
          type: 'RepeaterItem',
          props: { index: { $index: true }, itemLabel: 'Item' },
          children: ['sku'],
          on: {
            remove: [
              {
                action: 'removeState',
                params: { statePath: '/data/items', index: { $index: true } },
              },
            ],
          },
        },
        sku: { type: 'Text', props: { name: 'sku', label: 'SKU', value: { $bindItem: 'sku' } } },
      },
    },
    state: {
      data: {
        items: [
          { _key: 'one', sku: 'First' },
          { _key: 'two', sku: 'Second' },
        ],
      },
    },
    actions: { header: [] },
    catalogVersion: '0.1',
  }
  return (
    <PupitreRenderer
      page={page as never}
      pupitre={panel}
      registry={registry}
      runAction={async () => {}}
      submitForm={() => {}}
      upload={async () => ({})}
      toast={() => {}}
    />
  )
}

test('Select changes its selected option', async ({ mount }) => {
  const view = await mount(<Fixture name="Select" />)
  const select = view.getByRole('combobox')
  await select.click()
  await view.getByRole('option', { name: 'Draft' }).click()
  await expect(select).toContainText('Draft')
  await expect(view.locator('input[name="status"]')).toHaveValue('draft')
})

test('Tabs switch the visible panel while retaining panel content', async ({ mount }) => {
  const view = await mount(<Fixture name="Tabs" />)
  const tab = view.getByRole('tab').nth(1)
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
})

test('Modal close control invokes its callback', async ({ mount }) => {
  let closed = false
  const view = await mount(
    <OpenModal
      onClose={() => {
        closed = true
      }}
    />
  )
  await view.getByRole('button', { name: 'Close dialog' }).click()
  await expect.poll(() => closed).toBe(true)
})

test('FileUpload posts selected files to the descriptor URL', async ({ mount, page }) => {
  let uploaded = false
  await page.route('**/upload', async (route) => {
    uploaded = true
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        key: 'file-key',
        url: '/file.png',
        name: 'file.png',
        size: 4,
        mime: 'image/png',
      }),
    })
  })
  const view = await mount(<Fixture name="FileUpload" />)
  await view
    .locator('input[type="file"]')
    .setInputFiles({ name: 'file.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  await expect.poll(() => uploaded).toBe(true)
})

test('Repeater add/remove does not lose a typed value in the retained item', async ({ mount }) => {
  const view = await mount(<RepeaterRuntime />)
  const inputs = view.locator('input')
  await inputs.nth(1).fill('typed value')
  await view.getByRole('button', { name: 'Add item' }).click()
  await expect(inputs).toHaveCount(3)
  await view.getByRole('button', { name: 'Remove' }).first().click()
  await expect(view.locator('input').nth(0)).toHaveValue('typed value')
})
