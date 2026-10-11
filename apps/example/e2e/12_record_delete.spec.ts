import { pupitreTest, expect } from './fixtures/pupitre_test.js'

pupitreTest(
  'delete from an edit page returns to the list with one Deleted toast',
  async ({ admin, page }) => {
    await admin.login()
    const title = `Delete E2E ${Date.now()}`
    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click()
    await admin.fillField('Title', title)
    await admin.fillField('Slug', `delete-e2e-${Date.now()}`)
    await admin.fillField('Category', 'Culture')
    await page.getByRole('button', { name: 'Create Post' }).click()
    await expect(page).toHaveURL(/\/admin\/acme\/posts\/\d+\/edit/)
    const postId = page.url().match(/posts\/(\d+)\/edit/)?.[1]
    expect(postId).toBeTruthy()

    await page.goto('/admin/acme/posts')
    const row = admin.postRow(title)
    await expect(row).toBeVisible()
    await page.goto(`/admin/acme/posts/${postId}/edit`)

    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page
      .getByRole('button', { name: /delete|confirm/i })
      .last()
      .click()

    await expect(page).toHaveURL(/\/admin\/acme\/posts(?:\?.*)?$/)
    await expect(row).toHaveCount(0)
    await expect(page.locator('[role="status"]').filter({ hasText: 'Deleted' })).toHaveCount(1)
  }
)

pupitreTest('clearing an optional date persists null on edit', async ({ admin, page }) => {
  await admin.login()
  await page.goto('/admin/acme/posts/2/edit')
  const publishedAt = page.getByLabel('Published at')
  await expect(publishedAt).toHaveValue(/.+/)
  await publishedAt.fill('')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL('/admin/acme/posts/2/edit')

  await page.reload()
  await expect(page.getByLabel('Published at')).toHaveValue('')
})
