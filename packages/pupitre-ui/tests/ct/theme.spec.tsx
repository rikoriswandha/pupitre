import { test, expect } from '@playwright/experimental-ct-react'
import { ThemeStory } from './stories/theme.story.js'

test('top navigation groups render as dropdowns and applies density and width', async ({
  mount,
}) => {
  const view = await mount(<ThemeStory sidebar="top-nav" />)
  await expect(
    view.locator('..').locator('[data-sidebar="top-nav"][data-density="compact"]')
  ).toBeVisible()
  await expect(view.locator('main')).toHaveCSS('max-width', '768px')
  await view.getByText('Content', { exact: true }).click()
  await expect(view.getByRole('link', { name: 'Posts' })).toBeVisible()
})

test('collapsed rail toggle persists its state per panel', async ({ mount, page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const view = await mount(<ThemeStory />)
  await view.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(view.locator('..').locator('div[data-sidebar="expanded"]')).toHaveClass(
    /md:grid-cols-\[4rem/
  )
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('pupitre:theme-test:sidebar-collapsed')))
    .toBe('true')
  await view.unmount()
  const remounted = await mount(<ThemeStory />)
  await expect(remounted.locator('..').locator('div[data-sidebar="expanded"]')).toHaveClass(
    /md:grid-cols-\[4rem/
  )
})

test('shell emits documented CSS hooks and an unlayered host rule overrides utilities', async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const view = await mount(<ThemeStory />)
  const root = view.locator('..')
  for (const hook of [
    'shell',
    'sidebar',
    'brand',
    'nav',
    'nav-group',
    'nav-item',
    'topbar',
    'main',
    'page-header',
    'page-title',
    'page-body',
  ]) {
    await expect(root.locator(`[data-pupitre-${hook}]`).first(), hook).toBeAttached()
  }
  await page.addStyleTag({
    content: '[data-pupitre-page-title] { font-family: monospace; border-top: 7px solid red; }',
  })
  const title = root.locator('[data-pupitre-page-title]')
  await expect(title).toHaveCSS('font-family', 'monospace')
  await expect(title).toHaveCSS('border-top-width', '7px')
})
test('mobile navigation opens at 375px and density does not inflate checkbox controls', async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const view = await mount(<ThemeStory />)
  const toggle = view.getByRole('button', { name: 'Open navigation', includeHidden: true })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toHaveAttribute('aria-haspopup', 'dialog')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const navigation = page.getByRole('dialog', { name: 'Navigation', exact: true })
  await expect(navigation).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-controls', (await navigation.getAttribute('id'))!)
  await navigation.getByRole('button', { name: 'Close navigation' }).click()
  await expect(navigation).toBeHidden()
  await expect(
    Number.parseFloat(
      await view
        .getByRole('checkbox', { name: 'Density checkbox' })
        .evaluate((el) => getComputedStyle(el).minHeight)
    )
  ).not.toBe(40)
})
