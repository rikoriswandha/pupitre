import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'action modal deep links, footer actions, and info-only modal work',
  async ({ admin, page }) => {
    await admin.login()
    const row = await admin.row('Field Notes 03')
    await admin.openAction('Publish', row)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page).toHaveURL(/action=publish&record=\d+/)
    const deepLink = page.url()
    await page.reload()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Publish post' })).toBeVisible()
    await page.getByRole('button', { name: 'Send a preview notification' }).click()
    await admin.expectToast('Preview:')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).not.toHaveURL(/action=publish/)

    await admin.openAction('Publication help', row)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit' })).toHaveCount(0)
    await expect(page.getByText('Publish schedules the post')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await page.goto(deepLink)
    await expect(page.getByRole('dialog')).toBeVisible()
  }
)

pupitreTest(
  'rate-limited action returns a client error toast after its allowed attempts',
  async ({ admin }) => {
    await admin.login()
    const row = await admin.row('Field Notes 04')
    for (let attempt = 0; attempt < 3; attempt++) {
      await admin.openAction('Rate limited', row)
      if (attempt < 2) await admin.expectToast('Rate-limited action ran')
    }
    await admin.expectToast('Too many attempts')
  }
)
