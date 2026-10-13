import { AdminPage, pupitreTest, expect } from '@rikology/pupitre-ui/testing'
import { examplePanel } from './panel.js'

pupitreTest(
  'catalog cluster groups resource navigation and preserves tenant-prefixed sibling routes',
  async ({ page }) => {
    const admin = new AdminPage(page, examplePanel)
    await admin.login()
    await page.goto('/admin/acme/catalog/categories')
    const nav = page.getByRole('navigation', { name: 'Cluster navigation' })
    await expect(nav.getByRole('link', { name: 'Categories' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Catalog' })
    ).toBeVisible()
    await nav.getByRole('link', { name: 'Tags' }).click()
    await expect(page).toHaveURL('/admin/acme/catalog/tags')
    await page.setViewportSize({ width: 390, height: 844 })
    await nav.getByRole('link', { name: 'Categories' }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/admin/acme/catalog/categories')
    await expect(nav.getByRole('link', { name: 'Tags' })).toBeVisible()
  }
)
