import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'
import sharp from 'sharp'

pupitreTest(
  'library uploads can be selected as a post cover and viewed',
  async ({ admin, page }) => {
    await admin.login()
    await page.goto('/admin/acme/media')
    await page.getByRole('button', { name: 'Upload media', exact: true }).click()
    const dialog = page.getByRole('dialog').filter({ has: page.locator('form') })
    const png = await sharp({
      create: { width: 640, height: 480, channels: 3, background: '#00aa88' },
    })
      .png()
      .toBuffer()
    await dialog
      .locator('input[type=file]')
      .setInputFiles({ name: 'media-cover.png', mimeType: 'image/png', buffer: png })
    await expect(dialog.getByText('media-cover.png', { exact: true })).toBeVisible()
    const imported = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/media/actions/upload-media')
    )
    await dialog.getByRole('button', { name: 'Upload media', exact: true }).click()
    const importedResponse = await imported
    expect(importedResponse.status(), await importedResponse.text()).toBe(200)
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('main img').first()).toBeVisible()
    await page.goto('/admin/acme/posts/1/edit')
    await page.getByRole('tab', { name: 'Media', exact: true }).click()
    await page.getByRole('button', { name: 'Choose media' }).click()
    const library = page.getByRole('region', { name: 'Media library' })
    await library
      .getByRole('button', { name: /\.png$/ })
      .first()
      .click()
    await expect(page.getByRole('group', { name: 'Library cover' }).locator('ol img')).toBeVisible()
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname === '/admin/acme/posts/1'
    )
    await page.getByRole('button', { name: 'Save post' }).click()
    const savedResponse = await saved
    expect(savedResponse.status()).toBeLessThan(400)
    await page.goto('/admin/acme/posts/1')
    await expect(page.getByText('Library cover', { exact: true })).toBeVisible()
    await expect(
      page
        .locator('main img')
        .filter({ hasNot: page.locator('[hidden]') })
        .last()
    ).toBeVisible()
    // Neither the library JSON protocol nor forged picker IDs may cross tenant boundaries.
    const otherTenant = await page.request.get('/admin/globex/_pupitre/media')
    const rows = (await otherTenant.json()) as { rows: unknown[] }
    expect(rows.rows).toEqual([])
  }
)
