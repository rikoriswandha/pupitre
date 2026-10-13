import { test, expect } from '@playwright/experimental-ct-react'
import AxeBuilder from '@axe-core/playwright'
import { RichEditorPlusStory } from './stories/rich_editor.story.js'

test('merge-tag trigger and toolbar insert atomic tags', async ({ mount, page }) => {
  const view = await mount(<RichEditorPlusStory />)
  const editor = view.getByRole('textbox', { name: 'Body' })
  await expect(editor).toBeVisible()
  await editor.pressSequentially('{{')
  await expect(page.getByRole('listbox', { name: 'Suggestions' })).toBeVisible()
  await editor.press('Enter')
  await expect(editor.locator('[data-type="mergeTag"]')).toHaveAttribute('data-id', 'name')
  await view.getByRole('button', { name: 'Merge tags' }).click()
  await expect(page.getByRole('menu')).toHaveAttribute('data-pupitre-popup', '')
  await page.getByRole('menuitem', { name: 'Today' }).click()
  await expect(editor.locator('[data-type="mergeTag"]')).toHaveCount(2)
})

test('mention providers support keyboard selection and persist the trigger', async ({
  mount,
  page,
}) => {
  const view = await mount(<RichEditorPlusStory />)
  const editor = view.getByRole('textbox', { name: 'Body' })
  await editor.pressSequentially('@')
  await expect(page.getByRole('option', { name: 'Alice' })).toBeVisible()
  await expect(editor).toHaveAttribute(
    'aria-controls',
    (await page.getByRole('listbox', { name: 'Suggestions' }).getAttribute('id'))!
  )
  const alice = page.getByRole('option', { name: 'Alice' })
  await expect(alice).toHaveAttribute('aria-selected', 'true')
  await expect(editor).toHaveAttribute('aria-activedescendant', (await alice.getAttribute('id'))!)
  await editor.press('ArrowDown')
  const bob = page.getByRole('option', { name: 'Bob' })
  await expect(bob).toHaveAttribute('aria-selected', 'true')
  await expect(editor).toHaveAttribute('aria-activedescendant', (await bob.getAttribute('id'))!)
  await editor.press('Enter')
  await expect(editor.locator('[data-type="mention"]')).toHaveAttribute('data-id', 'bob')
  await expect(editor.locator('[data-type="mention"]')).toHaveAttribute('data-char', '@')
  await expect(editor).not.toHaveAttribute('aria-controls')
  await expect(editor).not.toHaveAttribute('aria-activedescendant')
  await editor.pressSequentially('#Pro')
  await expect(page.getByRole('option', { name: 'Project' })).toBeVisible()
  await editor.press('Enter')
  await expect(editor.locator('[data-char="#"]')).toHaveAttribute('data-id', 'project')
})

test('custom block form inserts and edits a labelled card and remains accessible', async ({
  mount,
  page,
}) => {
  const view = await mount(<RichEditorPlusStory />)
  await expect(view.getByRole('textbox', { name: 'Body' })).toBeVisible()
  await view.getByRole('button', { name: 'Insert block' }).click()
  await expect(page.getByRole('menu')).toHaveAttribute('data-pupitre-popup', '')
  await page.getByRole('menuitem', { name: 'Callout' }).click()
  const dialog = page.getByRole('dialog', { name: 'Callout' })
  await expect(dialog.getByRole('textbox', { name: 'Callout title' })).toHaveValue('')
  await dialog.getByRole('textbox', { name: 'Callout title' }).fill('Initial callout')
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(view.getByText('Initial callout')).toBeVisible()
  await view.getByRole('button', { name: 'Edit block' }).click()
  await expect(dialog.getByRole('textbox', { name: 'Callout title' })).toHaveValue(
    'Initial callout'
  )
  await dialog.getByRole('textbox', { name: 'Callout title' }).fill('Updated callout')
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished))
  )
  const audit = await new AxeBuilder({ page: page as never })
    .exclude('[data-base-ui-focus-guard]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(audit.violations).toEqual([])
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(view.getByText('Updated callout')).toBeVisible()
  await expect(view.getByRole('textbox', { name: 'Post title' })).toHaveValue('Outer post title')
})

test('nested server block errors remain visible and mark the editor invalid', async ({ mount }) => {
  const view = await mount(<RichEditorPlusStory invalid />)
  await expect(view.getByRole('textbox', { name: 'Body' })).toHaveAttribute('aria-invalid', 'true')
  await expect(view.getByRole('alert')).toHaveText('Callout title is required')
})

test('suggestions remain above a modal and escape clears editor accessibility state', async ({
  mount,
  page,
}) => {
  await mount(<RichEditorPlusStory modal />)
  const editor = page.getByRole('textbox', { name: 'Body' })
  await editor.pressSequentially('@')
  const popup = page.getByRole('listbox', { name: 'Suggestions' })
  await expect(popup).toBeVisible()
  await expect(popup).toHaveAttribute('data-pupitre-popup', '')
  await expect(editor).toHaveAttribute('aria-controls', (await popup.getAttribute('id'))!)
  expect(
    await popup.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return element.contains(
        document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      )
    })
  ).toBe(true)
  for (const dark of [false, true]) {
    await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark)
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {})))
    )
    const audit = await new AxeBuilder({ page: page as never })
      .exclude('[data-base-ui-focus-guard]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(audit.violations).toEqual([])
  }
  await editor.press('Escape')
  await expect(popup).toHaveCount(0)
  await expect(editor).not.toHaveAttribute('aria-activedescendant')
  await expect(editor).not.toHaveAttribute('aria-expanded')
})
