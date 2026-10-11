import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'publish notification appears in tray and can be marked read',
  async ({ admin, page }) => {
    await admin.login()
    const tray = page.getByRole('button', { name: 'Notifications' })
    await tray.click()
    const markAllRead = page.getByRole('button', { name: 'Mark all read', exact: true })
    await expect(markAllRead).toBeVisible()
    await expect(page.getByText('Loading notifications…', { exact: true })).toHaveCount(0)
    if (await markAllRead.isEnabled()) await markAllRead.click()
    await expect(tray.locator('span')).toHaveCount(0)
    await tray.click()
    const row = await admin.row('Field Notes 06')
    await admin.openAction('Publish', row)
    await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Publish post', exact: true })
      .click()
    await admin.expectToast('Post published')

    await tray.click()
    await expect(tray.locator('span')).toHaveText('1')
    await expect(
      page.getByRole('region', { name: 'Notifications' }).getByText('Post published').first()
    ).toBeVisible()
    await page.getByRole('button', { name: 'Mark all read' }).click()
    await expect(tray.locator('span')).toHaveCount(0)
  }
)
