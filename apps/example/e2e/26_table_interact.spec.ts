import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'table interactions edit, defer, reorder, persist columns and render cards',
  async ({ admin, page }) => {
    await admin.login()
    const title = `Inline table ${Date.now()}`
    await page.goto('/admin/acme/posts')
    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click()
    await admin.fillField('Title', title)
    await admin.fillField('Slug', title.toLowerCase().replaceAll(' ', '-'))
    await admin.fillField('Category', 'Culture')
    await page
      .getByRole('button', { name: /create|save/i })
      .last()
      .click()
    await page.waitForURL(/\/admin\/acme\/posts\/\d+\/edit/)
    await page.goto('/admin/acme/posts')
    await page.getByRole('searchbox', { name: 'Search' }).fill(title)
    await page.getByRole('searchbox', { name: 'Search' }).press('Enter')
    const row = page.getByRole('row').filter({ hasText: title })
    await expect(row).toBeVisible()
    const patch = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' && response.url().includes('/column/isFeatured')
    )
    await row.getByRole('switch', { name: /featured/i }).check()
    const patchResponse = await patch
    expect(patchResponse.status()).toBe(204)

    const listUrl = page.url()
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await page.getByRole('combobox', { name: 'Filter Status', exact: true }).click()
    await page.getByRole('option', { name: 'Published', exact: true }).click()
    await expect(page).toHaveURL(listUrl)
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page).toHaveURL(/filters/)

    const orderBatch = `Order Batch ${Date.now()}`
    await page.goto('/admin/acme/catalog/categories')
    for (const suffix of ['A', 'B']) {
      await page
        .getByRole('button', { name: /create/i })
        .first()
        .click()
      await admin.fillField('Name', `${orderBatch} ${suffix}`)
      await admin.fillField(
        'Slug',
        `${orderBatch.toLowerCase().replaceAll(' ', '-')}-${suffix.toLowerCase()}`
      )
      await page
        .getByRole('button', { name: /create|save/i })
        .last()
        .click()
      await page.waitForURL(/\/admin\/acme\/catalog\/categories\/\d+\/edit/)
      await page.goto('/admin/acme/catalog/categories')
    }
    await page.getByRole('searchbox', { name: 'Search' }).fill(orderBatch)
    await page.getByRole('searchbox', { name: 'Search' }).press('Enter')
    await expect(page.getByRole('row').filter({ hasText: orderBatch })).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Reorder', exact: true })).toBeDisabled()
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('')
    await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter')
    await expect(page.getByRole('button', { name: 'Reorder', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Reorder' }).click()
    const first = page.getByRole('row').filter({ hasText: `${orderBatch} A` })
    const reorder = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().includes('/categories/reorder')
    )
    await first.getByRole('button', { name: /Move .* down/i }).focus()
    await page.keyboard.press('Enter')
    const response = await reorder
    expect(response.status()).toBe(204)
    await expect(first).toBeVisible()

    await page.goto('/admin/acme/posts')
    await page.getByRole('button', { name: 'Columns', exact: true }).click()
    const views = page.getByRole('checkbox', { name: 'Views', exact: true })
    await views.check()
    await page.reload()
    await page.getByRole('button', { name: 'Columns', exact: true }).click()
    await expect(page.getByRole('checkbox', { name: 'Views', exact: true })).toBeChecked()

    await page.goto('/admin/acme/users')
    await expect(page.locator('.pupitre-table-grid article').first()).toBeVisible()
  }
)
