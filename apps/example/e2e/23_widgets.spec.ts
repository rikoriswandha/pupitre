import { AdminPage, pupitreTest, expect } from '@rikology/pupitre-ui/testing'
import { examplePanel } from './panel.js'

pupitreTest('dashboard widgets filter and resource edit header widget render', async ({ page }) => {
  const admin = new AdminPage(page, examplePanel)
  await admin.login()
  await page.goto('/admin/acme/')
  await expect(page.getByRole('heading', { name: 'Posts by status' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Posts per month' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Latest posts' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Post status', exact: true }).click()
  await page.getByRole('option', { name: 'Published', exact: true }).click()
  await expect(page).toHaveURL(/filters%5Bstatus%5D=published|filters\[status\]=published/)

  await page.goto('/admin/acme/posts')
  await admin.row('Field Notes 01').getByRole('button', { name: 'View' }).click()
  await page
    .getByRole('navigation', { name: 'Record navigation' })
    .getByRole('link', { name: 'Edit', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Post summary' })).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Post summary' }).getByText('Views', { exact: true })
  ).toBeVisible()
})
