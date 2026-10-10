import { test, expect } from '@playwright/experimental-ct-react'
import {
  DirtyFailureStory,
  ActionStory,
  ConfirmStory,
  FormStory,
  DataTableStory,
  RepeaterItemLabelStory,
  RepeaterStory,
  SelectStory,
  TabsStory,
  UploadStory,
  RichEditorStory,
  CustomFilterStory,
  KeyValueStory,
  LiveBlurStory,
  NativeClearableSelectStory,
  NumericSelectStory,
  PersistedUploadStory,
  RepeaterErrorStory,
  TextSuffixStory,
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

test('Repeater item label templates resolve in each item scope', async ({ mount }) => {
  const view = await mount(<RepeaterItemLabelStory />)
  await expect(view.getByRole('heading', { name: 'SKU A-100' })).toBeVisible()
  await expect(view.getByRole('heading', { name: 'SKU B-200' })).toBeVisible()
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
test('KeyValue key edits retain input focus', async ({ mount }) => {
  const view = await mount(<KeyValueStory />)
  const key = view.getByRole('textbox', { name: 'Metadata' }).first()
  await key.fill('alpha-renamed')
  await expect(key).toBeFocused()
})

test('Select matches a numeric record value to its string option', async ({ mount }) => {
  const view = await mount(<NumericSelectStory />)
  await expect(view.getByRole('combobox')).toContainText('One')
})

test('FileUpload clears persisted values locally and permits single-file replacement', async ({
  mount,
  page,
}) => {
  await page.route('**/upload', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        key: 'new-file.png',
        url: '/new-file.png',
        name: 'new-file.png',
        size: 1,
        mime: 'image/png',
      }),
    })
  })
  const view = await mount(<PersistedUploadStory />)
  await view.getByRole('button', { name: 'Remove persisted-cover.png' }).click()
  await expect(view.getByText('persisted-cover.png')).toHaveCount(0)
  await expect(view.getByText(/Upload removal failed/)).toHaveCount(0)
  const input = view.locator('input[type="file"]')
  await expect(input).toBeEnabled()
  await input.setInputFiles({
    name: 'replacement.png',
    mimeType: 'image/png',
    buffer: Buffer.from('x'),
  })
  await expect(view.getByText('new-file.png')).toBeVisible()
})

test('live onBlur fields update bound state only after blur', async ({ mount }) => {
  const view = await mount(<LiveBlurStory />)
  const input = view.getByLabel('Search')
  await input.fill('match')
  await expect(view.getByText('Matched')).toHaveCount(0)
  await input.blur()
  const boundValue = await view.evaluate(() =>
    (
      window as Window & { __ctPupitreStore?: { get(path: string): unknown } }
    ).__ctPupitreStore?.get('/data/search')
  )
  expect(boundValue).toBe('match')
  await expect(view.getByText('Matched')).toBeVisible()
})

test('repeater errors and field ids resolve to the matching item', async ({ mount }) => {
  const view = await mount(<RepeaterErrorStory />)
  const fields = view.getByLabel('SKU')
  await expect(fields).toHaveCount(2)
  await expect(fields.nth(0)).toHaveAttribute('id', 'items.0.sku')
  await expect(fields.nth(1)).toHaveAttribute('id', 'items.1.sku')
  await expect(view.getByText('Invalid SKU')).toHaveCount(1)
  await expect(view.locator('[id="items.1.sku-error"]')).toBeVisible()
})

test('custom filter is seeded from URL and applies only on submit', async ({ mount, page }) => {
  page.on('console', (m) => console.log('BROWSER', m.text()))
  const view = await mount(<CustomFilterStory />)
  expect(await view.evaluate(() => window.location.search)).toContain(
    'filters%5Brange%5D%5Bterm%5D=seeded'
  )
  const term = view.getByLabel('Term')
  console.log('CTFILTER', await view.innerHTML())
  await expect(term).toHaveValue('seeded')
  await term.fill('draft')
  const calls = view.getByTestId('router-calls')
  await expect(calls).toHaveText('[]')
  await view.getByRole('button', { name: 'Apply' }).click()
  await expect(calls).toContainText('filters%5Brange%5D%5Bterm%5D=draft')
})
test('Select supports the native clearable mode', async ({ mount }) => {
  const view = await mount(<NativeClearableSelectStory />)
  const select = view.getByLabel('Category', { exact: true })
  await expect(select).toHaveValue('1')
  await view.getByRole('button', { name: 'Clear Category' }).click()
  await expect(select).toHaveValue('')
})

test('Text renders its suffix', async ({ mount }) => {
  const view = await mount(<TextSuffixStory />)
  await expect(view.getByText('.ts')).toBeVisible()
})
test('dirty guard baseline remains dirty after a 422 validation response', async ({ mount }) => {
  const view = await mount(<DirtyFailureStory />)
  const form = view.locator('form')
  await view.getByLabel('Title').fill('Unsaved title')
  await view.getByRole('button', { name: 'Save' }).click()
  await expect(view.getByText('Required')).toBeVisible()
  await expect(form).toHaveAttribute('data-dirty', 'true')
})
