import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'status filter, search and sort persist in the URL and history',
  async ({ admin, page }) => {
    await admin.login()
    await page.getByRole('searchbox', { name: 'Search' }).fill('Field Notes 0')
    await page.getByRole('searchbox', { name: 'Search' }).press('Enter')
    await expect(page).toHaveURL(/q=Field(?:%20|\+)Notes(?:%20|\+)0/)
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await page.getByRole('combobox', { name: 'Filter Status', exact: true }).click()
    await page.getByRole('option', { name: 'Published', exact: true }).click()
    await expect(page).not.toHaveURL(/published/)
    await page.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(page).toHaveURL(/published/)
    await expect(page).toHaveURL(/q=Field(?:%20|\+)Notes(?:%20|\+)0/)
    await page.getByRole('button', { name: 'Title', exact: true }).click()
    await expect(page).toHaveURL(/sort=.*title/)
    expect(page.url()).toContain('published')
    const targetUrl = page.url()
    await page.reload()
    await expect(page).toHaveURL(targetUrl)
    await page.goBack()
    await expect(page).not.toHaveURL(targetUrl)
  }
)
