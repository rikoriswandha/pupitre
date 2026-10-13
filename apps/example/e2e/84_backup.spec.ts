import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'administrator creates and privately downloads a database backup',
  async ({ admin, page }, testInfo) => {
    testInfo.setTimeout(90_000)
    await admin.login()
    await admin.gotoResource('backups')
    await expect(page.getByRole('heading', { name: 'Backups', exact: true })).toBeVisible()
    const completedRows = page.getByRole('row').filter({ hasText: 'Completed' })
    const previousCount = await completedRows.count()
    const previousId = previousCount
      ? await completedRows.first().getByRole('cell').first().innerText()
      : undefined
    const createdPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/actions/create-backup') && response.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Create backup', exact: true }).click()
    const created = await createdPromise
    expect(created.status(), await created.text()).toBe(200)
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible({
      timeout: 60_000,
    })
    await expect(completedRows.first().getByRole('cell').first()).not.toHaveText(
      previousId ?? '__no-existing-backup__',
      { timeout: 60_000 }
    )
    const backupId = await page
      .getByRole('row')
      .filter({ hasText: 'Completed' })
      .first()
      .getByRole('cell')
      .first()
      .innerText()
    const row = page.getByRole('row').filter({ hasText: backupId })
    const downloadPromise = page.waitForEvent('download')
    await row.getByRole('button', { name: 'Download', exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe(`backup-${backupId}.gz`)
    const path = await download.path()
    expect(path).not.toBeNull()
    expect(
      gunzipSync(await readFile(path!))
        .subarray(0, 15)
        .toString()
    ).toBe('SQLite format 3')
    await row.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(row).not.toBeVisible()
  }
)
