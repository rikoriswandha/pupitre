import { test, expect } from '@playwright/experimental-ct-react'
import {
  ActionStory,
  ConfirmStory,
  FormStory,
  DataTableStory,
  RepeaterStory,
  SelectStory,
  TabsStory,
  UploadStory,
  RichEditorStory,
} from './stories/catalog.story.js'

test('Select updates its bound state', async ({ mount, page }) => {
  const view = await mount(<SelectStory />)
  const select = view.getByRole('combobox')
  await select.click()
  await page.getByRole('option', { name: 'Draft' }).click()
  await expect(select).toContainText('Draft')
  await expect(view.locator('input[name="status"]')).toHaveValue('draft')
})

test('Repeater adds two rows and retains the second typed value after removing the first', async ({
  mount,
}) => {
  const view = await mount(<RepeaterStory />)
  await view.getByRole('button', { name: 'Add item' }).click()
  await view.getByRole('button', { name: 'Add item' }).click()
  const inputs = view.locator('input')
  await expect(inputs).toHaveCount(2)
  await inputs.nth(0).fill('first typed')
  await inputs.nth(1).fill('second typed')
  await view.getByRole('button', { name: 'Remove' }).first().click()
  await expect(view.locator('input')).toHaveCount(1)
  await expect(view.locator('input').first()).toHaveValue('second typed')
})

test('DataTable header sorting visits the sorted URL and refetches only data', async ({
  mount,
}) => {
  const view = await mount(<DataTableStory />)
  await view.getByRole('button', { name: 'Title' }).click()
  const calls = view.getByTestId('router-calls')
  await expect
    .poll(async () => JSON.parse((await calls.textContent()) ?? '[]').length)
    .toBeGreaterThan(0)
  const first = JSON.parse((await calls.textContent()) ?? '[]')[0]
  expect(first.method).toBe('visit')
  expect(first.only).toEqual(['data'])
  expect(new URL(first.url, 'http://localhost').searchParams.get('sort')).toBe('title')
})

test('Tabs switch to the other panel', async ({ mount }) => {
  const view = await mount(<TabsStory />)
  const tabs = view.getByRole('tab')
  await tabs.nth(1).click()
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(view.getByRole('textbox', { name: 'Media content' })).toHaveValue('Media panel')
  await expect(view.getByRole('textbox', { name: 'Details content' })).toBeHidden()
})

test('form action loads a modal, posts data with the action header, and closes on success', async ({
  mount,
  page,
}) => {
  const view = await mount(<ActionStory />)
  await expect(page.getByText('Title')).toBeVisible()
  await page
    .getByRole('button', { name: 'Edit' })
    .evaluate((button) => (button as HTMLButtonElement).click())
  await expect(view.getByTestId('modal-open')).toHaveText('false')
  const calls = JSON.parse((await view.getByTestId('router-calls').textContent()) ?? '[]')
  const post = calls.find((call: { method: string }) => call.method === 'POST')
  expect(post.url).toBe('/actions/edit')
  expect(post.headers['x-pupitre-action']).toBe('1')
  expect(post.body).toEqual({ data: { title: 'Example', items: [{ sku: 'ABC' }] } })
})

test('ConfirmDialog cancel sends no request', async ({ mount, page }) => {
  await mount(<ConfirmStory />)
  await page
    .getByRole('button', { name: 'Cancel' })
    .evaluate((button) => (button as HTMLButtonElement).click())
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __ctConfirmRequests?: number }).__ctConfirmRequests)
    )
    .toBe(0)
})

test('FileUpload shows the uploaded image preview', async ({ mount, page }) => {
  await page.route('**/upload', async (route) => {
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
  const view = await mount(<UploadStory />)
  await view
    .locator('input[type="file"]')
    .setInputFiles({ name: 'file.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  await expect(view.getByRole('link', { name: 'Preview' })).toHaveAttribute('href', '/file.png')
  await expect(view.locator('img')).toBeVisible()
})

test('RichEditor requests its separate tiptap chunks only after mounting', async ({
  mount,
  page,
}) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  const tiptapChunk = () => requests.some((url) => /\/assets\/dist-[^/?]+\.js/.test(url))
  expect(tiptapChunk()).toBe(false)
  await mount(<RichEditorStory />)
  await expect.poll(tiptapChunk).toBe(true)
})

test('Form submit button sends the bound data with the form method and url', async ({ mount }) => {
  const view = await mount(<FormStory />)
  await view.getByLabel('Title').fill('Published title')
  await view.getByRole('button', { name: 'Save' }).click()
  const calls = view.getByTestId('router-calls')
  await expect
    .poll(async () => JSON.parse((await calls.textContent()) ?? '[]').length)
    .toBeGreaterThan(0)
  expect(JSON.parse((await calls.textContent()) ?? '[]')[0]).toEqual({
    method: 'put',
    url: '/admin/posts/4',
    data: { title: 'Published title' },
  })
})
