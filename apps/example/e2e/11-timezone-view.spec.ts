import { pupitreTest, expect } from './fixtures/pupitre_test.js'

pupitreTest('infolist renders published dates in the panel timezone', async ({ admin, page }) => {
  await admin.login()
  await page.goto('/admin/posts/1')
  await expect(page.getByText('2026 Oct 07, 19:00')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Field Notes 01' })).toBeVisible()
})

