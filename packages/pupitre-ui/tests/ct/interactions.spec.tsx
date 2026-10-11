import { test, expect } from '@playwright/experimental-ct-react'
import {
  ActionStory,
  ConfirmStory,
  CustomFilterStory,
  DataTableStory,
  DirtyFailureStory,
  FormStory,
  KeyValueInvalidStory,
  KeyValueStory,
  LiveBlurStory,
  NativeClearableSelectStory,
  StaticSelectActionsStory,
  AsyncSelectControlsStory,
  NumericSelectStory,
  PersistedUploadStory,
  RepeaterErrorStory,
  RepeaterItemLabelStory,
  RepeaterLayoutStory,
  RepeaterStory,
  RichEditorStory,
  SectionFieldContractStory,
  SelectStory,
  TableContractStory,
  TabsStory,
  TextSuffixStory,
  ThemeShellStory,
  UploadSaveStory,
  DefaultToggleStory,
  NestedNamesStory,
  UploadStory,
  NestedFormFocusStory,
  SearchDebounceStory,
} from './stories/catalog.story.js'

test('Toggle defaults to a primary checked track and keeps the horizontal layout', async ({
  mount,
}) => {
  const view = await mount(<DefaultToggleStory />)
  const toggle = view.getByRole('switch', { name: 'Enabled' })
  await expect(toggle).toHaveAttribute('data-checked', '')
  expect((await toggle.getAttribute('class')) ?? '').toContain('data-[checked]:bg-primary')
  const wrapperClass = (await toggle.locator('..').getAttribute('class')) ?? ''
  expect(wrapperClass).toContain('inline-flex')
  expect(wrapperClass).toContain('items-center')
  expect(wrapperClass).toContain('gap-3')
  expect(wrapperClass).not.toContain('grid')
})

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
  expect(post.body).toEqual({ data: { title: '01012024', items: [{ sku: 'ABC' }] } })
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
  await view.locator('input[type="file"]').setInputFiles({
    name: 'file.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3S8AAAAASUVORK5CYII=',
      'base64'
    ),
  })
  await expect(view.getByRole('dialog', { name: 'Edit image' })).toBeVisible()
  await view.getByRole('button', { name: 'Apply crop' }).click()
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

test('custom filter is seeded from URL and applies only on submit', async ({ mount }) => {
  const view = await mount(<CustomFilterStory />)
  expect(await view.evaluate(() => window.location.search)).toContain(
    'filters%5Brange%5D%5Bterm%5D=seeded'
  )
  const term = view.getByLabel('Term')
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
test('static selects render and run prefix and suffix actions', async ({ mount, page }) => {
  const view = await mount(<StaticSelectActionsStory />)
  await expect(view.getByRole('button', { name: 'Prefix action' })).toBeVisible()
  await expect(view.getByRole('button', { name: 'Suffix action' })).toBeVisible()
  await view.getByRole('button', { name: 'Prefix action' }).click()
  await view.getByRole('button', { name: 'Suffix action' }).click()
  const actions = await page.evaluate(() => {
    const windowWithActions = window as Window & { __staticSelectActions?: string[] }
    return windowWithActions.__staticSelectActions
  })
  expect(actions).toEqual(['prefix', 'suffix'])
})
test('async multi-select options toggle off and expose removable chips', async ({ mount }) => {
  const view = await mount(<AsyncSelectControlsStory />)
  const tags = view.getByRole('listbox', { name: 'Tags' })
  const culture = tags.getByRole('option', { name: 'Culture', exact: true })

  const tagsInput = view.getByRole('textbox', { name: 'Tags' })
  await expect(tagsInput).toHaveAttribute('id', 'tags')
  await expect(tagsInput).toHaveAttribute('aria-describedby', 'tags-hint tags-helper tags-error')
  await expect(tagsInput).toHaveAttribute('aria-invalid', 'true')
  await expect(tagsInput).toHaveAttribute('aria-required', 'true')
  await expect(culture).toHaveAttribute('aria-selected', 'true')

  await culture.click()
  await expect(view.getByRole('button', { name: 'Remove Culture' })).toHaveCount(0)
  await expect(culture).toHaveAttribute('aria-selected', 'false')

  await culture.click()
  const removeCulture = view.getByRole('button', { name: 'Remove Culture' })
  await expect(removeCulture).toBeVisible()
  await removeCulture.click()
  await expect(view.getByRole('button', { name: 'Remove Culture' })).toHaveCount(0)

  const disabledOptions = view.getByRole('listbox', { name: 'Disabled' })
  const readOnlyOptions = view.getByRole('listbox', { name: 'Read only' })
  await expect(disabledOptions).toHaveAttribute('aria-disabled', 'true')
  await expect(readOnlyOptions).toHaveAttribute('aria-disabled', 'true')
  await expect(disabledOptions.getByRole('option', { name: 'Culture' })).toBeDisabled()
  await expect(readOnlyOptions.getByRole('option', { name: 'Design' })).toBeDisabled()
  await expect(view.getByRole('button', { name: 'Create option' }).nth(0)).toBeDisabled()
  await expect(view.getByRole('button', { name: 'Create option' }).nth(1)).toBeDisabled()
  await expect(view.getByRole('button', { name: 'Load more' }).nth(0)).toBeEnabled()
  await expect(view.getByRole('button', { name: 'Load more' }).nth(1)).toBeDisabled()
  await expect(view.getByRole('button', { name: 'Load more' }).nth(2)).toBeDisabled()
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
test('FileUpload clears a newly uploaded value after a successful same-page save without deleting the blob', async ({
  mount,
  page,
}) => {
  let deletes = 0
  await page.route('**/upload', async (route) => {
    if (route.request().method() === 'DELETE') {
      deletes++
      await route.fulfill({ status: 204 })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        key: 'saved-file.png',
        url: '/saved-file.png',
        name: 'saved-file.png',
        size: 1,
        mime: 'image/png',
      }),
    })
  })
  const view = await mount(<UploadSaveStory />)
  await view.locator('input[type="file"]').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: Buffer.from('x'),
  })
  await expect(view.getByText('saved-file.png', { exact: true })).toBeVisible()
  await view.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(view.locator('form')).not.toHaveAttribute('data-dirty', 'true')
  await view.getByRole('button', { name: 'Remove saved-file.png' }).click()
  const cover = await view.evaluate(() =>
    (
      window as Window & { __ctPupitreStore?: { get(path: string): unknown } }
    ).__ctPupitreStore?.get('/data/cover')
  )
  expect(cover).toBeNull()
  await expect(view.getByText('saved-file.png', { exact: true })).toHaveCount(0)
  expect(deletes).toBe(0)
})

test('FileUpload sends DELETE when removing an upload before saving', async ({ mount, page }) => {
  let deletes = 0
  await page.route('**/upload', async (route) => {
    if (route.request().method() === 'DELETE') {
      deletes += 1
      await route.fulfill({ status: 204 })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        key: 'unsaved-file.png',
        url: '/unsaved-file.png',
        name: 'unsaved-file.png',
        size: 1,
        mime: 'image/png',
      }),
    })
  })
  const view = await mount(<UploadSaveStory />)
  await view.locator('input[type="file"]').setInputFiles({
    name: 'unsaved-file.png',
    mimeType: 'image/png',
    buffer: Buffer.from('x'),
  })
  await expect(view.getByText('unsaved-file.png', { exact: true })).toBeVisible()
  await view.getByRole('button', { name: 'Remove unsaved-file.png' }).click()
  await expect.poll(() => deletes).toBe(1)
  await expect(view.getByText('unsaved-file.png', { exact: true })).toHaveCount(0)
})

test('KeyValue add, move, and remove do not write invalid duplicate-key rows', async ({
  mount,
}) => {
  const view = await mount(<KeyValueInvalidStory />)
  const inputs = view.locator('input')
  await inputs.nth(2).fill('alpha')
  await view.getByRole('button', { name: 'Move alpha up' }).last().click()
  await inputs.nth(6).fill('delta')
  await inputs.nth(7).fill('4')
  await view.getByRole('button', { name: 'Add' }).click()
  await inputs.nth(4).fill('')
  await view.getByRole('button', { name: 'Remove', exact: true }).last().click()
  const value = await view.evaluate(() =>
    (
      window as Window & { __ctPupitreStore?: { get(path: string): unknown } }
    ).__ctPupitreStore?.get('/data/metadata')
  )
  expect(value).toEqual({ alpha: '1', beta: '2', gamma: '3' })
})

test('table cells honor badge and wrap descriptors; row action variants are rendered', async ({
  mount,
}) => {
  const view = await mount(<TableContractStory />)
  const badge = view.getByText('Ready')
  await expect(badge).toHaveCSS('background-color', 'rgb(1, 2, 3)')
  await expect(badge).toHaveClass(/rounded-full/)
  await expect(view.getByText('This title wraps onto more than one line')).toHaveClass(
    /whitespace-normal/
  )
  await expect(view.getByRole('button', { name: 'View' })).toHaveClass(/underline/)
  await expect(view.getByRole('button', { name: 'Edit' })).toHaveClass(/border/)
})

test('bulk key bindings run against selected rows and are disabled without a selection', async ({
  mount,
  page,
}) => {
  const view = await mount(<TableContractStory />)
  const action = view.getByRole('button', { name: 'Publish selected' })
  await expect(action).toBeDisabled()
  await page.keyboard.press('Control+P')
  expect(
    await page.evaluate(() => (window as Window & { __ctActions?: unknown[] }).__ctActions)
  ).toBeUndefined()
  await view.getByRole('checkbox', { name: 'Select row 7' }).check()
  await expect(action).toBeEnabled()
  await page.keyboard.press('Control+P')
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __ctActions?: unknown[] }).__ctActions?.length)
    )
    .toBe(1)
  expect(
    await page.evaluate(() => (window as Window & { __ctActions?: unknown[] }).__ctActions)
  ).toEqual([{ action: 'publish', ids: [7] }])
})

test('Section icon and Checkbox/Toggle inline and color props are rendered', async ({
  mount,
  page,
}) => {
  const view = await mount(<SectionFieldContractStory />)
  await expect(view.getByRole('heading', { name: 'Details' }).locator('svg')).toBeVisible()
  await expect(view.getByRole('checkbox', { name: 'Active' }).locator('xpath=..')).toHaveClass(
    /inline-flex/
  )
  const toggle = view.getByRole('switch', { name: 'Enabled' })
  await expect(toggle).toHaveCSS('background-color', 'rgb(10, 20, 30)')
  await expect(toggle.locator('xpath=..')).toHaveClass(/inline-flex/)
  await page.evaluate(() =>
    (
      window as Window & { __ctPupitreStore?: { set(path: string, value: unknown): void } }
    ).__ctPupitreStore?.set('/data/enabled', false)
  )
  await expect(toggle).toHaveCSS('background-color', 'rgb(40, 50, 60)')
  await expect(view.getByRole('button', { name: 'Open' })).toHaveClass(/underline/)
  await expect(view.getByRole('button', { name: 'Inspect header' })).toBeVisible()
})

test('repeater grid controls field layout and its configured add label is shown', async ({
  mount,
}) => {
  const view = await mount(<RepeaterLayoutStory />)
  await expect(view.getByRole('button', { name: 'Add SKU' })).toBeVisible()
  await expect(view.locator('[data-repeater-fields]').first()).toHaveAttribute(
    'style',
    /grid-template-columns: repeat\(2/
  )
})

test('nested Checkbox, CheckboxList, Radio, Toggle, Tags, and Hidden names use absolute binding paths', async ({
  mount,
}) => {
  const view = await mount(<NestedNamesStory />)
  for (const field of ['check', 'choices', 'radio', 'toggle', 'tags', 'hidden']) {
    await expect(view.locator(`[name="items.0.${field}"]`).first()).toHaveCount(1)
  }
})

test('dark theme applies to document and portaled Modal; favicon updates and theme is restored', async ({
  mount,
  page,
}) => {
  const previousPrimary = await page.evaluate(() => {
    const style = document.documentElement.style
    const previous = {
      value: style.getPropertyValue('--primary'),
      priority: style.getPropertyPriority('--primary'),
    }
    style.setProperty('--primary', 'rgb(1, 2, 3)', 'important')
    return previous
  })
  const view = await mount(<ThemeShellStory />)
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(
    await page.evaluate(() => document.documentElement.style.getPropertyValue('--primary'))
  ).toBe('rgb(12, 34, 56)')
  await expect(page.getByRole('dialog', { name: 'Portal dialog' })).toBeVisible()
  await page.getByRole('button', { name: 'Modal action' }).click()
  await expect(page.getByTestId('modal-action')).toHaveText('clicked')
  expect(
    await page
      .getByRole('dialog', { name: 'Portal dialog' })
      .evaluate((dialog) => Boolean(dialog.closest('.dark')))
  ).toBe(true)
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /test-favicon\.ico/)
  await view.unmount()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  expect(
    await page.evaluate(() => ({
      value: document.documentElement.style.getPropertyValue('--primary'),
      priority: document.documentElement.style.getPropertyPriority('--primary'),
    }))
  ).toEqual({ value: 'rgb(1, 2, 3)', priority: 'important' })
  await page.evaluate((previous: { value: string; priority: string }) => {
    const style = document.documentElement.style
    if (previous.value) style.setProperty('--primary', previous.value, previous.priority)
    else style.removeProperty('--primary')
  }, previousPrimary)
})

test('system dark mode follows prefers-color-scheme changes', async ({ mount, page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  const view = await mount(<ThemeShellStory darkMode="system" />)
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(
    await page
      .getByRole('dialog', { name: 'Portal dialog' })
      .evaluate((dialog) => Boolean(dialog.closest('.dark')))
  ).toBe(true)
  await view.unmount()
})

test('custom filter submits its embedded form on Enter', async ({ mount }) => {
  const view = await mount(<CustomFilterStory />)
  const calls = view.getByTestId('router-calls')
  await view.getByLabel('Term').fill('submitted-by-enter')
  await view.getByLabel('Term').press('Enter')
  await expect(calls).toContainText('filters%5Brange%5D%5Bterm%5D=submitted-by-enter')
})

test('DataTable search debounce submits once without re-arming', async ({ mount, page }) => {
  const view = await mount(<SearchDebounceStory />)
  const calls = view.getByTestId('router-calls')
  await view.getByLabel('Search').fill('debounced')
  await expect(calls).toContainText('q=debounced', { timeout: 2_000 })
  await page.waitForTimeout(400)
  expect(JSON.parse((await calls.textContent()) ?? '[]')).toHaveLength(1)
})

test('DataTable Enter cancels its pending search debounce', async ({ mount, page }) => {
  const view = await mount(<SearchDebounceStory />)
  const calls = view.getByTestId('router-calls')
  const search = view.getByLabel('Search')
  await search.fill('entered')
  await search.press('Enter')
  await expect(calls).toContainText('q=entered')
  await page.waitForTimeout(400)
  expect(JSON.parse((await calls.textContent()) ?? '[]')).toHaveLength(1)
})
test('submitForm focuses the nested absolute name reported by first-error validation', async ({
  mount,
}) => {
  const view = await mount(<NestedFormFocusStory />)
  await view.getByRole('button', { name: 'Submit' }).click()
  await expect(view.getByRole('checkbox', { name: 'Check' })).toBeFocused()
})
