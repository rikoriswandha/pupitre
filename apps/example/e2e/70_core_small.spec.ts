import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'environment indicator and radar/scatter render; strict app panel boots',
  async ({ admin, page }) => {
    await admin.login()
    await admin.gotoResource('store')
    const indicator = page.locator('[data-environment-indicator]')
    await expect(indicator).toBeVisible()
    await expect(indicator.locator('[aria-hidden="true"]')).toHaveText(
      process.env.PUPITRE_E2E_ENVIRONMENT ?? 'production'
    )
    await expect(page.getByRole('region', { name: 'Inventory profile', exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Price and stock', exact: true })).toBeVisible()
    await expect(page.locator('.recharts-radar-polygon')).toBeVisible()
    await expect(page.locator('.recharts-scatter-symbol').first()).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('[data-environment-indicator]')).toBeVisible()
    await page.goto('/app/users')
    await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible()
  }
)
