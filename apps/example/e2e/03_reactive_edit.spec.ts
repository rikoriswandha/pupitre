import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest('publishedAt appears immediately when status changes', async ({ admin, page }) => {
  await admin.login()
  await page.goto('/admin/acme/posts/1/edit')
  await expect(page.getByLabel(/published at/i)).toHaveValue('2026-10-07T19:00')
  await page.goto('/admin/acme/posts/3/edit')
  const publishedAt = page.getByLabel(/published at/i)
  await expect(publishedAt).toBeHidden()
  const saveRequests: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'PUT' && new URL(request.url()).pathname === '/admin/acme/posts/3')
      saveRequests.push(request.url())
  })
  await admin.fillField('Status', 'Published')
  await expect(publishedAt).toBeVisible()
  expect(saveRequests).toHaveLength(0)
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname === '/admin/acme/posts/3'
  )
  await page.getByRole('button', { name: 'Save post' }).click()
  await saved
  await admin.fillField('Status', 'Draft')
  const restored = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname === '/admin/acme/posts/3'
  )
  await page.getByRole('button', { name: 'Save post' }).click()
  await restored
})
