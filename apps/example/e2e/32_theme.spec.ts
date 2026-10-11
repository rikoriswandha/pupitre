import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest('applies panel themes and persists sidebar layout', async ({ admin, page }) => {
  await admin.login()
  await expect(page.locator('[data-density="compact"]')).toBeVisible()
  const collapse = page.getByRole('button', { name: 'Collapse sidebar' })
  await collapse.click()
  await expect(page.locator('[data-sidebar="expanded"]')).toBeVisible()
  await expect(page.locator('div[data-sidebar="expanded"]')).toHaveClass(/md:grid-cols-\[4rem/)
  await page.reload()
  await expect(page.locator('div[data-sidebar="expanded"]')).toHaveClass(/md:grid-cols-\[4rem/)

  await page.goto('/app')
  await expect(page.locator('[data-sidebar="top-nav"]')).toBeVisible()
  await expect(page.locator('main')).toHaveCSS('max-width', '768px')
  await page.getByText('Administration', { exact: true }).click()
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Users', exact: true })
  ).toBeVisible()
})
