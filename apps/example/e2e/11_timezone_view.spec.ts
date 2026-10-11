import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest('infolist renders published dates in the panel timezone', async ({ admin, page }) => {
  await admin.login()
  await page.goto('/admin/acme/posts/1')
  await expect(page.getByText('2026 Oct 07, 19:00')).toBeVisible()
  await expect(page.locator('h1')).toHaveText('Field Notes 01')
})
