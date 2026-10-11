import { AdminPage, pupitreTest, expect } from '@rikology/pupitre-ui/testing'
import { examplePanel } from './panel.js'

pupitreTest(
  'global search groups resources and navigates to a selected record',
  async ({ page }) => {
    const admin = new AdminPage(page, examplePanel)
    await admin.login()
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('dialog', { name: 'Global search' })).toBeVisible()
    await page.getByRole('combobox', { name: 'Search resources' }).fill('Field Notes 01')
    await expect(page.getByRole('dialog').getByText('Posts', { exact: true })).toBeVisible()
    const result = page.getByRole('option', { name: /Field Notes 01/ })
    await expect(result).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/admin\/(?:[^/]+\/)?posts\/\d+$/)
    await expect(page.locator('h1')).toHaveText('Field Notes 01')
  }
)
