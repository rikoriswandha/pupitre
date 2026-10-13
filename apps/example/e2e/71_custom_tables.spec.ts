import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'custom-data currencies preserve URL state and open server-resolved modals',
  async ({ admin, page }) => {
    await admin.login()
    await admin.gotoResource('store')
    const currencies = page.getByRole('region', { name: 'Currencies', exact: true })
    await expect(currencies.getByText('Indonesian rupiah', { exact: true })).toBeVisible()
    await currencies.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page).toHaveURL(/currencies%5Bpage%5D=2|currencies\[page\]=2/)
    await expect(currencies.getByText('US dollar', { exact: true })).toBeVisible()
    await page.reload()
    await expect(currencies.getByText('US dollar', { exact: true })).toBeVisible()
    await currencies.getByRole('button', { name: 'Name', exact: true }).click()
    await expect(page).toHaveURL(/currencies%5Bsort%5D=name|currencies\[sort\]=name/)
    const search = currencies.getByRole('searchbox')
    await search.fill('yen')
    await expect(currencies.getByText('Japanese yen', { exact: true })).toBeVisible()
    await expect(currencies.getByText('US dollar', { exact: true })).toHaveCount(0)
    await currencies.getByRole('button', { name: 'Inspect', exact: true }).click()
    const dialog = page.getByRole('dialog').filter({ has: page.locator('form') })
    await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
      'Japanese yen'
    )
    await expect(dialog.getByRole('textbox', { name: 'Region', exact: true })).toHaveValue('Asia')
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await search.fill('')
    await currencies.getByRole('button', { name: 'Filters', exact: true }).click()
    await page.getByRole('combobox', { name: 'Filter Region', exact: true }).click()
    await page.getByRole('option', { name: 'Europe', exact: true }).click()
    await expect(currencies.getByText('Euro', { exact: true })).toBeVisible()
    await expect(currencies.getByText('Pound sterling', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(
      /currencies%5Bfilters%5D%5Bregion%5D=Europe|currencies\[filters\]\[region\]=Europe/
    )
  }
)

pupitreTest(
  'component loader receives tenant and filter values and supports explicit reload',
  async ({ admin, page }) => {
    await admin.login()
    await admin.gotoResource('store')
    const loaded = page.getByTestId('component-loader-data')
    await expect(loaded).toContainText('Acme')
    await page.getByRole('combobox', { name: 'Sales channel', exact: true }).click()
    await page.getByRole('option', { name: 'Retail', exact: true }).click()
    await expect(loaded).toContainText('retail')
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(loaded).toContainText('retail')
  }
)
