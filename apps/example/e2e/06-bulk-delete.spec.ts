import { pupitreTest, expect } from './fixtures/pupitre_test.js'

pupitreTest('bulk delete confirms and removes two selected posts', async ({ admin, page }) => {
  await admin.login()
  const batch = `Bulk delete ${Date.now()}`

  for (const suffix of ['A', 'B']) {
    await page.getByRole('button', { name: /create/i }).first().click()
    await admin.fillField('Title', `${batch} ${suffix}`)
    await admin.fillField('Slug', `${batch.toLowerCase().replaceAll(' ', '-')}-${suffix.toLowerCase()}`)
    await admin.fillField('Category', 'Culture')
    await page.getByRole('button', { name: /create|save/i }).last().click()
    await page.waitForURL(/\/admin\/posts\/\d+\/edit/)
    await page.goto('/admin/posts')
  }

  await page.getByLabel('Search').fill(batch)
  await page.getByLabel('Search').press('Enter')
  const first = admin.postRow(`${batch} A`)
  const second = admin.postRow(`${batch} B`)
  await expect(first).toBeVisible()
  await expect(second).toBeVisible()
  await first.getByRole('checkbox').check()
  await second.getByRole('checkbox').check()
  await page.getByRole('button', { name: /delete selected|delete/i }).last().click()
  await page.getByRole('button', { name: /delete|confirm/i }).last().click()
  await expect(first).toHaveCount(0)
  await expect(second).toHaveCount(0)
})
