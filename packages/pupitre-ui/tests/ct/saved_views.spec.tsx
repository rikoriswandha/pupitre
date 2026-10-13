import { test, expect } from '@playwright/experimental-ct-react'
import AxeBuilder from '@axe-core/playwright'
import { SavedViewsStory } from './stories/saved_views.story.js'

test('Views supports keyboard presets and prefixed state without clearing unrelated query', async ({
  mount,
  page,
}) => {
  await mount(<SavedViewsStory prefix />)
  await page.getByRole('button', { name: 'Views', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Drafts', exact: true }).click()
  await expect(page.getByLabel('Visited URL')).toContainText('q=outer')
  await expect(page.getByLabel('Visited URL')).toContainText(
    'comments%5Bfilters%5D%5Bstatus%5D=draft'
  )
  await expect(page.getByLabel('Visited URL')).not.toContainText('page')
  await expect(page.getByLabel('Visible columns')).toContainText('false')
})

test('save, apply, rename, default, publish and confirmed delete flows are accessible', async ({
  mount,
  page,
}) => {
  await mount(<SavedViewsStory />)
  await page.getByRole('button', { name: 'Views', exact: true }).click()
  await expect(page.getByRole('dialog').first()).toHaveAttribute('data-pupitre-popup', '')
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished))
  })
  const menuAccessibility = await new AxeBuilder({ page: page as never })
    .exclude('[data-base-ui-focus-guard]')
    .analyze()
  expect(menuAccessibility.violations).toEqual([])
  await page.getByRole('button', { name: 'Save current view', exact: true }).click()
  await page.getByLabel('View name', { exact: true }).fill('Editorial')
  await page.getByRole('checkbox', { name: 'Default view', exact: true }).check()
  await expect(page.getByRole('checkbox', { name: 'Default view', exact: true })).toHaveClass(
    /size-6/
  )
  await expect(page.getByRole('dialog').last()).toHaveAttribute('data-pupitre-popup', '')
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished))
  })
  const accessibility = await new AxeBuilder({ page: page as never })
    .exclude('[data-base-ui-focus-guard]')
    .analyze()
  expect(accessibility.violations).toEqual([])
  await page.getByRole('button', { name: 'Save view', exact: true }).click()
  await expect(page.getByLabel('View request')).toContainText('"isDefault":true')
  await page.getByRole('button', { name: 'Views', exact: true }).click()
  await page.getByRole('button', { name: 'Editorial Default', exact: true }).click()
  await expect(page.getByLabel('Visited URL')).toContainText('view=saved%3A1')
  await page.getByRole('button', { name: 'Views', exact: true }).click()
  await page.getByRole('button', { name: 'Update view', exact: true }).click()
  await expect(page.getByLabel('View request')).toContainText('"q":"hello"')
  await page.getByRole('button', { name: 'Unset default view', exact: true }).click()
  await expect(page.getByLabel('View request')).toContainText('"isDefault":false')
  await page.getByRole('button', { name: 'Make view public', exact: true }).click()
  await expect(page.getByLabel('View request')).toContainText('"isPublic":true')
  await page.getByRole('button', { name: 'Rename view', exact: true }).click()
  await page.getByLabel('View name', { exact: true }).fill('Shared editorial')
  await page.getByRole('button', { name: 'Save view', exact: true }).click()
  await page.getByRole('button', { name: 'Views', exact: true }).click()
  await page.getByRole('button', { name: 'Delete view', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Views', exact: true }).click()
  await page.getByRole('button', { name: 'Delete view', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Delete view', exact: true })).toHaveClass(
    /bg-destructive/
  )
  await page.getByRole('button', { name: 'Delete view', exact: true }).click()
  await expect(page.getByLabel('View request')).toContainText('"method":"DELETE"')
})
