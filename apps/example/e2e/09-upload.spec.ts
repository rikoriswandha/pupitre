import { pupitreTest, expect } from './fixtures/pupitre_test.js'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3S8AAAAASUVORK5CYII=',
  'base64'
)

pupitreTest('cover upload previews valid images and rejects renamed executables', async ({ admin, page }) => {
  await admin.login()
  await page.goto('/admin/posts/1/edit')
  await page.getByRole('tab', { name: 'Media' }).click()
  const fileInput = page.locator('input[type=file]').first()
  await fileInput.setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('img', { name: 'cover.png' })).toBeVisible()
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname === '/admin/posts/1'
  )
  await page.getByRole('button', { name: 'Save' }).click()
  await saved
  await page.goto('/admin/posts/1')
  await expect(page.locator('img').last()).toBeVisible()

  await page.goto('/admin/posts/2/edit')
  await page.getByRole('tab', { name: 'Media' }).click()
  await page.locator('input[type=file]').first().setInputFiles({
    name: 'fake.png',
    mimeType: 'image/png',
    buffer: Buffer.from('MZ executable payload'),
  })
  await expect(page.getByText(/fake\.png|upload failed/i).last()).toBeVisible()
})
