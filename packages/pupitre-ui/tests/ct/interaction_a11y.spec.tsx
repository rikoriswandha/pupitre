import { test, expect } from '@playwright/experimental-ct-react'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import {
  ChoiceA11yStory,
  EditorA11yStory,
  InteractiveFixtureA11yStory,
  TableA11yStory,
  TabsA11yStory,
  UploadA11yStory,
} from './stories/interaction_a11y.story.js'
import { WidgetsStory } from './stories/widgets.story.js'

async function assertAccessible(page: Page) {
  // Check stable interactive states, not a transient foreground/background
  // midpoint while a CSS color transition is still running. Base UI popups
  // start their fade-in a frame after mounting, so let it begin first.
  await page.evaluate(async () => {
    for (let frame = 0; frame < 2; frame++) {
      const { promise, resolve } = Promise.withResolvers<number>()
      requestAnimationFrame(resolve)
      await promise
    }
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {}))
    )
  })
  const results = await new AxeBuilder({ page: page as never })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Base UI's popup focus guards are invisible redirect sentinels, not content.
    .exclude('[data-base-ui-focus-guard]')
    .analyze()
  expect(results.violations).toEqual([])
}

test('Tabs use unique relationships, one tab stop, and skip disabled tabs with arrows/Home/End', async ({
  mount,
  page,
}) => {
  const view = await mount(<TabsA11yStory duplicate />)
  const tabs = view.getByRole('tab')
  const first = tabs.nth(0)
  await first.focus()
  await first.press('ArrowRight')
  await expect(tabs.nth(2)).toBeFocused()
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')
  await expect(first).toHaveAttribute('tabindex', '-1')
  await tabs.nth(2).press('Home')
  await expect(first).toBeFocused()
  await first.press('End')
  await expect(tabs.nth(2)).toBeFocused()
  await tabs.nth(2).press('ArrowRight')
  await expect(first).toBeFocused()
  await first.press('ArrowLeft')
  await expect(tabs.nth(2)).toBeFocused()
  await tabs.nth(2).press('Tab')
  await expect(view.getByRole('tabpanel').first()).toBeFocused()
  const ids = await tabs.evaluateAll((nodes) => nodes.map((node) => node.id))
  expect(new Set(ids).size).toBe(ids.length)
  await assertAccessible(page)
})

test('Required radios expose a named group and support arrow-key selection', async ({
  mount,
  page,
}) => {
  const view = await mount(<ChoiceA11yStory kind="Radio" />)
  await expect(view.getByRole('radiogroup', { name: 'Status' })).toHaveAttribute(
    'aria-required',
    'true'
  )
  const draft = view.getByRole('radio', { name: 'Draft' })
  await expect(view.getByRole('radio')).toHaveCount(3)
  await expect(view.getByRole('radio', { name: 'Locked', exact: true })).toBeDisabled()
  await draft.focus()
  await draft.press('ArrowDown')
  await expect(view.getByRole('radio', { name: 'Published' })).toBeChecked()
  const size = await draft.boundingBox()
  expect(size?.width).toBeGreaterThanOrEqual(24)
  expect(size?.height).toBeGreaterThanOrEqual(24)
  await expect(view.locator('fieldset')).not.toHaveAttribute('aria-required')
  await assertAccessible(page)
})

for (const multiple of [false, true]) {
  test(`ToggleButtons expose pressed state without unsupported required ARIA (${multiple ? 'multiple' : 'single'})`, async ({
    mount,
    page,
  }) => {
    const view = await mount(<ChoiceA11yStory kind="ToggleButtons" multiple={multiple} />)
    const published = view.getByRole('button', { name: 'Published' })
    const draft = view.getByRole('button', { name: 'Draft' })
    await draft.focus()
    await draft.press('ArrowRight')
    await expect(published).toBeFocused()
    await expect(draft).toHaveAttribute('tabindex', '-1')
    await published.press('Space')
    await expect(published).toHaveAttribute('aria-pressed', 'true')
    await expect(published).not.toHaveAttribute('aria-required')
    await expect(view.getByRole('group', { name: 'Status' })).not.toHaveAttribute('aria-required')
    await assertAccessible(page)
  })
  test(`Select popup is accessible when open (${multiple ? 'multiple' : 'single'}) and Escape restores focus`, async ({
    mount,
    page,
  }) => {
    const view = await mount(<ChoiceA11yStory kind="Select" multiple={multiple} />)
    const trigger = view.getByRole('combobox', { name: 'Status' })
    await trigger.focus()
    await trigger.press('ArrowDown')
    await expect(page.getByRole('listbox')).toBeVisible()
    await assertAccessible(page)
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await expect(page.getByRole('listbox')).toBeHidden()
  })
}

test('Searchable async multiple Select declares multiselection and supports listbox keyboard navigation', async ({
  mount,
  page,
}) => {
  const view = await mount(<ChoiceA11yStory kind="Select" multiple async />)
  await view.getByRole('combobox', { name: 'Status' }).click()
  const list = page.getByRole('listbox', { name: 'Status' })
  await expect(list).toHaveAttribute('aria-multiselectable', 'true')
  const draft = page.getByRole('option', { name: 'Draft' })
  const published = page.getByRole('option', { name: 'Published' })
  await draft.focus()
  await draft.press('ArrowDown')
  await expect(published).toBeFocused()
  await published.press('Space')
  await expect(published).toHaveAttribute('aria-selected', 'true')
  await published.press('Home')
  await expect(draft).toBeFocused()
  await draft.press('End')
  await expect(published).toBeFocused()
  await assertAccessible(page)
  await view.getByRole('button', { name: 'Remove Published' }).click()
  await view.getByRole('combobox', { name: 'Status' }).click()
  await expect(published).toHaveAttribute('aria-selected', 'false')
})

for (const sort of ['', 'title', '-title']) {
  test(`DataTable announces ${sort || 'unsorted'} header state`, async ({ mount, page }) => {
    const view = await mount(<TableA11yStory sort={sort} />)
    await expect(view.getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
      'aria-sort',
      sort === 'title' ? 'ascending' : sort === '-title' ? 'descending' : 'none'
    )
    await assertAccessible(page)
  })
}

test('DataTable selection announces mixed state and filter/column/row disclosures work with keyboard', async ({
  mount,
  page,
}) => {
  const view = await mount(<TableA11yStory />)
  const selected = view.getByRole('checkbox', { name: 'Select row 1', exact: true })
  await selected.focus()
  await selected.press('Space')
  await expect(view.getByRole('checkbox', { name: 'Select all rows' })).toHaveAttribute(
    'aria-checked',
    'mixed'
  )
  for (const name of ['Filters', 'Columns', 'Row actions']) {
    const trigger = view.getByRole('button', { name, exact: true }).first()
    await trigger.focus()
    await trigger.press('Enter')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await assertAccessible(page)
    if (name === 'Filters')
      await expect(page.getByRole('combobox', { name: 'Filter Status' })).toBeVisible()
    if (name === 'Columns') {
      const column = page.getByRole('checkbox', { name: 'Status', exact: true })
      await column.focus()
      await column.press('Space')
      await expect(view.getByRole('columnheader', { name: 'Status', exact: true })).toHaveCount(0)
    }
    if (name === 'Row actions')
      await expect(page.getByRole('menuitem', { name: 'Edit' }).first()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  }
})

test('FileUpload associates field label, help and validation with keyboard-reachable input', async ({
  mount,
  page,
}) => {
  const view = await mount(<UploadA11yStory />)
  const input = view.getByLabel('Attachment', { exact: true })
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(input).toHaveAttribute('aria-required', 'true')
  await expect(input).toHaveAttribute('aria-describedby', /helper.*error/)
  await input.focus()
  await expect(input).toBeFocused()
  await assertAccessible(page)
})

for (const kind of ['RichEditor', 'MarkdownEditor', 'CodeEditor'] as const) {
  test(`${kind} loaded editor and toolbar have accessible names and strict axe coverage`, async ({
    mount,
    page,
  }) => {
    const view = await mount(<EditorA11yStory kind={kind} />)
    await assertAccessible(page)
    const editor =
      kind === 'CodeEditor'
        ? view.locator('.cm-content')
        : view.getByRole('textbox', { name: 'Body' })
    await expect(editor).toBeVisible()
    await expect(editor).toHaveAttribute('aria-label', 'Body')
    if (kind === 'CodeEditor') {
      await expect(editor).toHaveAttribute('aria-invalid', 'true')
      await expect(editor).toHaveAttribute('aria-describedby', /helper.*error/)
      await editor.focus()
      await expect(editor).toBeFocused()
    }
    if (kind === 'RichEditor') {
      await expect(editor).toHaveAttribute('aria-invalid', 'true')
      await expect(editor).toHaveAttribute('aria-describedby', /helper.*error/)
      const toolbar = view.getByRole('toolbar', { name: 'Text formatting' })
      const buttons = toolbar.getByRole('button')
      await buttons.first().focus()
      await buttons.first().press('ArrowRight')
      await expect(buttons.nth(1)).toBeFocused()
    }
    if (kind === 'MarkdownEditor') {
      await expect(view.getByLabel('Choose an image to upload')).toHaveCount(1)
      await view.getByRole('button', { name: 'Preview', exact: true }).press('Enter')
      await assertAccessible(page)
      await view.getByRole('button', { name: 'Write', exact: true }).press('Enter')
      await expect(editor).toBeVisible()
    }
    await assertAccessible(page)
  })
}

test('Wizard skips hidden step fields and focuses the new current step after keyboard Next', async ({
  mount,
  page,
}) => {
  const view = await mount(<InteractiveFixtureA11yStory name="Wizard" />)
  const next = view.getByRole('button', { name: 'Next', exact: true })
  await next.focus()
  await next.press('Enter')
  const profile = view.getByRole('button', { name: '2 Profile' })
  await expect(profile).toHaveAttribute('aria-current', 'step')
  await expect(profile).toBeFocused()
  await expect(view.locator('[data-wizard-step="account"]')).toBeHidden()
  await assertAccessible(page)
  await view.getByRole('button', { name: 'Back', exact: true }).press('Enter')
  await expect(view.getByRole('button', { name: '1 Account' })).toBeFocused()
})

for (const name of ['Builder', 'Repeater'] as const) {
  test(`${name} collapsed/expanded and cloned items have accessible controls`, async ({
    mount,
    page,
  }) => {
    const view = await mount(<InteractiveFixtureA11yStory name={name} />)
    if (name === 'Repeater')
      await view.getByRole('button', { name: 'Add item', exact: true }).click()
    const collapse = view.locator('article').first().locator('button[aria-expanded]')
    await collapse.focus()
    await collapse.press('Enter')
    await expect(collapse).toHaveAttribute('aria-expanded', 'false')
    await assertAccessible(page)
    await collapse.press('Enter')
    await expect(collapse).toHaveAttribute('aria-expanded', 'true')
    await view
      .getByRole('button', { name: name === 'Builder' ? 'Clone block 1' : 'Clone', exact: true })
      .first()
      .press('Enter')
    await expect(view.locator('article')).toHaveCount(2)
    await assertAccessible(page)
  })
}

for (const name of [
  'Step',
  'Widget.Chart',
  'Widget.Stats',
  'Widget.Timeline',
  'Widget.Table',
] as const) {
  test(`${name} strict accessibility coverage`, async ({ mount, page }) => {
    const view = await mount(<InteractiveFixtureA11yStory name={name} />)
    if (name === 'Widget.Stats') {
      await expect(view.getByRole('img', { name: 'Trend: 2, 4, 6' })).toHaveCount(1)
    }
    if (name === 'Widget.Chart') {
      await expect(view.getByRole('table', { name: 'Chart data' })).toHaveCount(1)
      await expect(view.getByRole('cell', { name: '4', exact: true })).toHaveCount(1)
      await expect(view.locator('.recharts-wrapper')).toBeVisible()
    }
    await assertAccessible(page)
  })
}

test('FileUpload image crop dialog traps focus, closes with Escape, and restores file input focus', async ({
  mount,
  page,
}) => {
  const view = await mount(<InteractiveFixtureA11yStory name="FileUpload" />)
  const input = view.locator('input[type="file"]').first()
  await input.focus()
  await input.setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3S8AAAAASUVORK5CYII=',
      'base64'
    ),
  })
  const dialog = page.getByRole('dialog', { name: 'Edit image' })
  await expect(dialog).toBeVisible()
  await expect
    .poll(() => dialog.evaluate((node) => node.contains(document.activeElement)))
    .toBe(true)
  await dialog.getByRole('button', { name: 'Apply crop' }).focus()
  await page.keyboard.press('Tab')
  await expect
    .poll(() => dialog.evaluate((node) => node.contains(document.activeElement)))
    .toBe(true)
  await assertAccessible(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(input).toBeFocused()
})

test('WidgetGrid includes accessible stats, chart and table regions', async ({ mount, page }) => {
  await mount(<WidgetsStory />)
  await expect(page.getByRole('heading', { name: 'Monthly posts' })).toBeVisible()
  await assertAccessible(page)
})
