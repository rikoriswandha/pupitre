import { pupitreTest, expect } from './fixtures/pupitre_test.js'

pupitreTest('publish action updates its row without a full reload', async ({ admin, page }) => {
  await admin.login()
  await page.getByRole('searchbox', { name: 'Search' }).fill('Field Notes 03')
  await page.getByRole('searchbox', { name: 'Search' }).press('Enter')
  const row = await admin.postRow('Field Notes 03')
  await expect(row).toBeVisible()
  const reloads: string[] = []
  page.on('load', () => reloads.push(page.url()))
  await admin.openAction('Publish', row)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page
    .getByRole('button', { name: /publish/i })
    .last()
    .click()
  await admin.expectToast('published')
  await expect(row.getByText('published', { exact: true })).toBeVisible()
  expect(reloads).toHaveLength(0)
})
