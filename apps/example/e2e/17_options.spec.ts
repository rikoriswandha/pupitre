import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'searches relationships and creates an option from the select modal',
  async ({ admin, page }) => {
    await admin.login()
    await page.getByRole('button', { name: 'Create' }).first().click()
    await admin.fillField('Title', `Options ${Date.now()}`)
    await admin.fillField('Slug', `options-${Date.now()}`)

    const search = page.getByRole('textbox', { name: 'Category' })
    await search.fill('Technology')
    await expect(page.getByRole('option', { name: 'Technology' })).toBeVisible()
    await page.getByRole('option', { name: 'Technology' }).click()

    const categorySearch = page.getByRole('textbox', { name: 'Category' })
    await categorySearch.fill('New options category')
    await page.getByRole('button', { name: 'Create option' }).first().click()
    await admin.fillField('Name', 'New options category')
    await admin.fillField('Slug', `new-options-category-${Date.now()}`)
    await page.getByRole('button', { name: 'Create option' }).last().click()
    await expect(
      page.getByRole('option', { name: 'New options category', exact: true })
    ).toBeVisible()

    await page.getByRole('button', { name: 'Save post' }).click()
    await expect(page).toHaveURL(/\/admin\/acme\/posts\/\d+\/edit/)
  }
)
