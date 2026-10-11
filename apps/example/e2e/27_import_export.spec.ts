import { readFile } from 'node:fs/promises'
import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest('admin can export posts and import a mapped CSV', async ({ admin, page }) => {
  await admin.login()
  await page.goto('/admin/acme')
  await page.getByRole('link', { name: 'Posts' }).click()
  await expect(page).toHaveURL(/\/admin\/acme\/posts/)

  const exportDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).first().click()
  const download = await exportDownload
  expect(download.suggestedFilename()).toMatch(/posts-.*\.csv/)
  const downloadPath = await download.path()
  expect(downloadPath).not.toBeNull()
  const csv = await readFile(downloadPath!, 'utf8')
  expect(csv).toContain('FIELD NOTES')

  const slug = `e2e-import-${Date.now()}`
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page.getByLabel('CSV file').setInputFiles({
    name: 'posts.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`title,slug,categoryId\nImported from CSV,${slug},1\n`),
  })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('title', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Import CSV' }).click()
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Import finished' })
      .getByText(/1 created, 0 updated, 0 failed/)
  ).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('Imported from CSV')
  await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter')
  await expect(page.getByRole('row', { name: /Imported from CSV/ })).toBeVisible()
})
