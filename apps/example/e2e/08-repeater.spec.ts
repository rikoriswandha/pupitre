import { pupitreTest, expect } from './fixtures/pupitre_test.js'

pupitreTest('repeater preserves the remaining item and validates its own row', async ({ admin, page }) => {
  await admin.login()
  await page.getByRole('button', { name: /create/i }).first().click()
  await admin.fillField('Title', `Repeater ${Date.now()}`)
  await admin.fillField('Slug', `repeater-${Date.now()}`)
  await admin.fillField('Category', 'Culture')
  await page.getByRole('button', { name: /add item/i }).click()
  await page.getByRole('button', { name: /add item/i }).click()
  await page.getByLabel('SKU').nth(0).fill('REMOVE-ME')
  await page.getByLabel('SKU').nth(1).fill('KEEP-ME')
  await page.getByLabel(/quantity/i).nth(0).fill('1')
  await page.getByLabel(/quantity/i).nth(1).fill('1')
  await page.getByLabel(/price/i).nth(0).fill('100')
  await page.getByLabel(/price/i).nth(1).fill('200')
  await page.getByRole('button', { name: 'Remove', exact: true }).first().click()
  await expect(page.getByLabel('SKU')).toHaveCount(1)
  await expect(page.getByLabel('SKU').first()).toHaveValue('KEEP-ME')
  await page.getByLabel('SKU').first().fill('')
  await page.locator('form').evaluate((element) => {
    const form = element as unknown as { noValidate: boolean }
    form.noValidate = true
  })
  await page.getByRole('button', { name: 'Create Post' }).click()
  await expect(page.getByText(/sku.*must be defined/i).last()).toBeVisible()
  await expect(page.getByLabel('SKU').first()).toHaveValue('')
})
