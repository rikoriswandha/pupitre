import { pupitreTest, expect } from './fixtures/pupitre_test.js'

pupitreTest('admin can navigate to seeded Posts', async ({ admin, page }) => {
  await admin.login()
  await page.goto('/admin/acme')
  await page.getByRole('link', { name: 'Posts' }).click()
  await expect(page).toHaveURL(/\/admin\/acme\/posts/)
  await expect(page.getByRole('row', { name: /Field Notes 01/ })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'Field Notes 02' })).toBeVisible()
})
