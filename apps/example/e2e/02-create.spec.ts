import { pupitreTest, expect } from './fixtures/pupitre_test.js'

pupitreTest('invalid posts show errors and valid posts redirect to edit', async ({ admin, page }) => {
  await admin.login()
  await page.getByRole('button', { name: 'Create' }).first().click()
  await page.locator('form').evaluate((element) => {
    const form = element as unknown as { noValidate: boolean }
    form.noValidate = true
  })
  await page.getByRole('button', { name: 'Create Post' }).click()
  await expect(page.getByText(/must be defined/i).first()).toBeVisible()

  const title = `E2E create ${Date.now()}`
  await admin.fillField('Title', title)
  await admin.fillField('Slug', `e2e-create-${Date.now()}`)
  await admin.fillField('Category', 'Culture')
  await page.getByRole('button', { name: 'Create Post' }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/\d+\/edit/)
  await admin.expectToast('created')
})
