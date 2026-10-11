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
test('mobile navigation opens at 375px and density does not inflate checkbox controls', async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const view = await mount(<ThemeStory />)
  const toggle = view.getByRole('button', { name: 'Open navigation' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toHaveAttribute('aria-controls', 'pupitre-mobile-navigation')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(view.locator('#pupitre-mobile-navigation')).toBeVisible()
  await expect(
    Number.parseFloat(
      await view
        .getByRole('checkbox', { name: 'Density checkbox' })
        .evaluate((el) => getComputedStyle(el).minHeight)
    )
  ).not.toBe(40)
})
