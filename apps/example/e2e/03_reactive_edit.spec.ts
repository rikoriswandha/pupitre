import { pupitreTest, expect } from './fixtures/pupitre_test.js'

pupitreTest('publishedAt appears immediately when status changes', async ({ admin, page }) => {
  await admin.login()
  await page.goto('/admin/acme/posts/1/edit')
  await expect(page.getByLabel(/published at/i)).toHaveValue('2026-10-07T19:00')
  await page.goto('/admin/acme/posts/3/edit')
  const publishedAt = page.getByLabel(/published at/i)
  await expect(publishedAt).toBeHidden()
  const requests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/admin/')) requests.push(request.url())
  })
  await admin.fillField('Status', 'Published')
  await expect(publishedAt).toBeVisible()
  expect(requests).toHaveLength(0)
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname === '/admin/acme/posts/3'
  )
  await page.getByRole('button', { name: 'Save' }).click()
  await saved
})
