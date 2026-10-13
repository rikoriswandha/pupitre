import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest('health shows real checks and supports forced refresh', async ({ admin, page }) => {
  await admin.login()
  await page.goto('/admin/acme/health')
  await expect(page.getByRole('heading', { name: 'Health', exact: true })).toBeVisible()
  await expect(page.getByText('Memory RSS check', { exact: true })).toBeVisible()
  await expect(page.getByText('Memory heap check', { exact: true })).toBeVisible()
  const response = page.waitForResponse(
    (result) => result.url().includes('/actions/run-checks') && result.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Run checks', exact: true }).click()
  const result = await response
  expect(result.status()).toBe(200)
  await expect(page.getByText('Memory RSS check', { exact: true })).toBeVisible()
})
