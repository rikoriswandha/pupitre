import { pupitreTest, expect } from './fixtures/pupitre_test.js'

pupitreTest(
  'publish notification appears in tray and can be marked read',
  async ({ admin, page }) => {
    await admin.login()
    const row = await admin.postRow('Field Notes 03')
    await admin.openAction('Publish', row)
    await page
      .getByRole('button', { name: /publish/i })
      .last()
      .click()
    await admin.expectToast('Post published')

    const tray = page.getByRole('button', { name: 'Notifications' })
    await expect(tray.locator('span')).toHaveText('1', { timeout: 35_000 })
    await tray.click()
    await expect(
      page.getByRole('region', { name: 'Notifications' }).getByText('Post published').first()
    ).toBeVisible()
    await page.getByRole('button', { name: 'Mark all read' }).click()
    await expect(tray.locator('span')).toHaveCount(0)
  }
)
