import { pupitreTest, expect } from './fixtures/pupitre_test.js'

pupitreTest('admin can navigate to seeded Posts', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@example.com')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/dashboard')
  await page.goto('/admin')
  await page.getByRole('link', { name: 'Posts' }).click()
  await expect(page).toHaveURL(/\/admin\/posts/)
  await expect(page.getByRole('row', { name: /Field Notes 01/ })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'Field Notes 02' })).toBeVisible()
})
