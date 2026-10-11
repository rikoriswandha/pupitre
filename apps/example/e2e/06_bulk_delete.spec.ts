import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest('bulk delete confirms and removes two selected posts', async ({ admin, page }) => {
  await admin.login()
  const batch = `Bulk delete ${Date.now()}`

  for (const suffix of ['A', 'B']) {
    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click()
    await admin.fillField('Title', `${batch} ${suffix}`)
    await admin.fillField(
      'Slug',
      `${batch.toLowerCase().replaceAll(' ', '-')}-${suffix.toLowerCase()}`
    )
    await admin.fillField('Category', 'Culture')
    await page
      .getByRole('button', { name: /create|save/i })
      .last()
      .click()
    await page.waitForURL(/\/admin\/acme\/posts\/\d+\/edit/)
    await page.goto('/admin/acme/posts')
  }

  await page.getByRole('searchbox', { name: 'Search' }).fill(batch)
  await page.getByRole('searchbox', { name: 'Search' }).press('Enter')
  const first = admin.row(`${batch} A`)
  const second = admin.row(`${batch} B`)
  await expect(first).toBeVisible()
  await expect(second).toBeVisible()
  await first.getByRole('checkbox', { name: /^Select row / }).check()
  await second.getByRole('checkbox', { name: /^Select row / }).check()
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(first).toHaveCount(0)
  await expect(second).toHaveCount(0)
})
