import { mkdir } from 'node:fs/promises'
import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest('three dogfood resources load and save visual evidence', async ({ admin, page }) => {
  await admin.login()
  await mkdir('tmp', { recursive: true })

  await page.screenshot({ path: 'tmp/pupitre-posts.png', fullPage: true })
  await page.goto('/admin/acme/posts/1/edit')
  await expect(page.getByLabel('Title')).toBeVisible()
  await page.screenshot({ path: 'tmp/pupitre-post-form.png', fullPage: true })
  await page.goto('/admin/acme/catalog/categories')
  await expect(page.getByText('Culture', { exact: true })).toBeVisible()
  await page.goto('/admin/acme/users')
  await expect(page.getByText('admin@example.com', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'tmp/pupitre-users.png', fullPage: true })
})
