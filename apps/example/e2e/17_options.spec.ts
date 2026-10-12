import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'searches relationships and creates an option from the select modal',
  async ({ admin, page }) => {
    await admin.login()
    await page.getByRole('button', { name: 'Create' }).first().click()
    await admin.fillField('Title', `Options ${Date.now()}`)
    await admin.fillField('Slug', `options-${Date.now()}`)

    const category = page.getByRole('combobox', { name: 'Category' })
    const search = page.getByRole('textbox', { name: 'Search options' })
    await category.click()
    await search.fill('Technology')
    await expect(page.getByRole('option', { name: 'Technology' })).toBeVisible()
    await page.getByRole('option', { name: 'Technology' }).click()
    await expect(category).toContainText('Technology')

    await category.click()
    await search.fill('New options category')
    await page.getByRole('button', { name: 'Create option' }).first().click()
    await admin.fillField('Name', 'New options category')
    await admin.fillField('Slug', `new-options-category-${Date.now()}`)
    await page.getByRole('button', { name: 'Create option' }).last().click()
    await expect(category).toContainText('New options category')

    await page.getByRole('button', { name: 'Save post' }).click()
    await expect(page).toHaveURL(/\/admin\/acme\/posts\/\d+\/edit/)
  }
)
