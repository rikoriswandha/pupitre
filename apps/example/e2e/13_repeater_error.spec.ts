import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'a 422 repeater error is shown only under the invalid second item',
  async ({ admin, page }) => {
    await admin.login()
    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click()
    await admin.fillField('Title', `Repeater error ${Date.now()}`)
    await admin.fillField('Slug', `repeater-error-${Date.now()}`)
    await admin.fillField('Category', 'Culture')
    await page.getByRole('button', { name: /add item/i }).click()
    await page.getByRole('button', { name: /add item/i }).click()
    await page.getByLabel('SKU').nth(0).fill('VALID-FIRST')
    await page.getByLabel('SKU').nth(1).fill('')
    await page
      .getByLabel(/quantity/i)
      .nth(0)
      .fill('1')
    await page
      .getByLabel(/quantity/i)
      .nth(1)
      .fill('1')
    await page.getByLabel(/price/i).nth(0).fill('100')
    await page.getByLabel(/price/i).nth(1).fill('200')
    await page.locator('form').evaluate((element) => {
      const form = element as unknown as { noValidate: boolean }
      form.noValidate = true
    })

    await page.getByRole('button', { name: 'Save post' }).click()

    const error = /sku.*must be defined/i
    const itemOne = page.getByRole('heading', { name: 'Item 1' }).locator('xpath=../..')
    const itemTwo = page.getByRole('heading', { name: 'Item 2' }).locator('xpath=../..')
    await expect(itemTwo.getByText(error)).toBeVisible()
    await expect(itemOne.getByText(error)).toHaveCount(0)
    await expect(page.getByText(error)).toHaveCount(1)
  }
)
