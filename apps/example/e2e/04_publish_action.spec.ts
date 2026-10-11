import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest('publish action updates its row without a full reload', async ({ admin, page }) => {
  await admin.login()
  await page.getByRole('searchbox', { name: 'Search' }).fill('Field Notes 03')
  await page.getByRole('searchbox', { name: 'Search' }).press('Enter')
  const row = await admin.row('Field Notes 03')
  await expect(row).toBeVisible()
  const reloads: string[] = []
  page.on('load', () => reloads.push(page.url()))
  await admin.openAction('Publish', row)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Publish post', exact: true }).click()
  await admin.expectToast('published')
  await expect(row.getByRole('combobox', { name: /^Status, row / })).toHaveValue('published')
  expect(reloads).toHaveLength(0)
})
