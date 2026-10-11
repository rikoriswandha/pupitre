import { test, expect } from '@playwright/experimental-ct-react'
import { SidebarStory } from './stories/sidebar.story.js'

test('persists collapsible group state per panel and group', async ({ mount, page }) => {
  await page.evaluate(() => localStorage.removeItem('pupitre:ct-sidebar:nav:Content'))
  const first = await mount(<SidebarStory />)
  await expect(page.getByRole('link', { name: /Posts/ })).toBeVisible()
  await page.getByRole('button', { name: 'Content' }).click()
  await expect(page.getByRole('link', { name: /Posts/ })).toHaveCount(0)
  await first.unmount()

  const second = await mount(<SidebarStory />)
  await expect(page.getByRole('link', { name: /Posts/ })).toHaveCount(0)
  await page.evaluate(() => localStorage.removeItem('pupitre:ct-sidebar:nav:Content'))
  await second.unmount()
})
test('collapsed navigation retains brand and badge names', async ({ mount }) => {
  const view = await mount(<SidebarStory collapsed />)
  await expect(view.getByRole('link', { name: 'Pupitre' })).toBeVisible()
  await expect(view.getByRole('link', { name: 'Posts, 4' })).toBeVisible()
})
