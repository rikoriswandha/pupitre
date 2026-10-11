import { AdminPage, pupitreTest, expect } from '@rikology/pupitre-ui/testing'
import { examplePanel } from './panel.js'

pupitreTest(
  'post relation managers render scoped comments and tag tables in tabs',
  async ({ page }) => {
    const admin = new AdminPage(page, examplePanel)
    await admin.login()
    await page.goto('/admin/acme/posts?q=Field%20Notes%2001')
    const postRow = admin.row('Field Notes 01')
    await postRow.getByRole('button', { name: 'View' }).click()
    await expect(page).toHaveURL(/\/admin\/acme\/posts\/\d+$/)

    const recordUrl = page.url()
    await expect(page.getByRole('tab', { name: /Comments/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Tags/ })).toBeVisible()
    await page.getByRole('tab', { name: /Comments/ }).click()
    await expect(page.getByRole('region', { name: 'Comments' })).toBeVisible()
    await expect(page.getByText('Reader note 01')).toBeVisible()

    await page.goto(`${recordUrl.replace(/\/$/, '')}/edit`)
    await page.getByRole('tab', { name: /Tags/ }).click()
    await expect(page.getByRole('region', { name: 'Tags' })).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Tags' }).getByText('Research', { exact: true })
    ).toBeVisible()
  }
)

pupitreTest(
  'simple modal resources create records without create or edit pages',
  async ({ page }) => {
    const admin = new AdminPage(page, examplePanel)
    await admin.login()
    await page.goto('/admin/acme/tags')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    const suffix = Date.now().toString()
    await page.getByRole('textbox', { name: 'Name' }).fill(`Modal Tag ${suffix}`)
    await page.getByRole('textbox', { name: 'Slug' }).fill(`modal-tag-${suffix}`)
    await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('row', { name: new RegExp(`Modal Tag ${suffix}`) })).toBeVisible()
    await expect(page).not.toHaveURL(/\/tags\/create/)
    await expect(page).not.toHaveURL(/\/tags\/[^/]+\/edit/)
  }
)
