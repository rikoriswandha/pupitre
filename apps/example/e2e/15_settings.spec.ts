import { pupitreTest, expect } from './fixtures/pupitre_test.js'

pupitreTest('admin can update and reload Settings', async ({ admin, page }) => {
  await admin.login()
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/settings$/)

  const siteName = `Settings ${Date.now()}`
  await admin.fillField('Site name', siteName)
  const maintenance = page.getByRole('switch', { name: 'Maintenance mode' })
  if (!(await maintenance.isChecked())) await maintenance.click()
  await admin.fillField('Default theme', 'Dark')
  await page.getByRole('button', { name: 'Save' }).click()
  await admin.expectToast('Saved successfully')
  await page.reload()
  await expect(page.getByLabel('Site name')).toHaveValue(siteName)
  await expect(page.getByRole('switch', { name: 'Maintenance mode' })).toBeChecked()

  await page.locator('form').evaluate((element) => {
    const form = element as unknown as { noValidate: boolean }
    form.noValidate = true
  })
  await page.getByLabel('Site name').fill('')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText(/must be defined/i).first()).toBeVisible()
})
