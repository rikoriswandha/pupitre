import { expect, pupitreTest } from '@rikology/pupitre-ui/testing'

pupitreTest('administrator impersonates a tenant member and leaves', async ({ page, admin }) => {
  await admin.login()
  await page.goto('/admin/acme/users')
  const row = page.getByRole('article').filter({ hasText: 'editor@example.com' })
  await row.getByRole('button', { name: 'More actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Impersonate', exact: true }).click()
  const banner = page.getByRole('region', { name: 'Impersonation', exact: true })
  await expect(banner).toContainText('You are signed in as')
  await banner.getByRole('button', { name: 'Leave', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/acme\/users$/)
  await expect(banner).toHaveCount(0)
})
