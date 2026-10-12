import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'table data groups, summaries, per-column search and soft-delete actions',
  async ({ admin, page }) => {
    await admin.login()
    await page.goto('/admin/acme/posts')
    await page.getByRole('button', { name: 'Columns', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Views' }).check()
    await page.getByRole('button', { name: 'Columns', exact: true }).click()
    await page.getByRole('combobox', { name: 'Group', exact: true }).click()
    await page.getByRole('option', { name: 'Post status', exact: true }).click()
    const draftGroup = page.getByRole('button', { name: /Post status: draft/i })
    await expect(draftGroup).toHaveAttribute('aria-expanded', 'true')
    await draftGroup.click()
    await expect(draftGroup).toHaveAttribute('aria-expanded', 'false')
    await draftGroup.click()
    await expect(
      page
        .getByRole('region', { name: 'Table summary', exact: true })
        .getByText('Views sum:', { exact: true })
    ).toBeVisible()
    await page.getByRole('searchbox', { name: /Views/i }).fill('1')
    await page.getByRole('searchbox', { name: /Views/i }).press('Enter')
    await expect(page).toHaveURL(
      /columns%5BviewsCount%5D%5Bsearch%5D|columns\[viewsCount\]\[search\]/
    )

    const title = `Soft delete ${Date.now()}`
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
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(title)
    await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter')
    const row = page.getByRole('row').filter({ hasText: title })
    await expect(row).toBeVisible()
    await admin.openAction('Delete', row)
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('row').filter({ hasText: title })).toHaveCount(0)

    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await page.getByRole('combobox', { name: 'Filter Trashed', exact: true }).click()
    await page.getByRole('option', { name: 'Only trashed', exact: true }).click()
    await page.getByRole('button', { name: 'Apply' }).click()
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    const trashedRow = page.getByRole('row').filter({ hasText: title })
    await expect(trashedRow).toBeVisible()
    await admin.openAction('Restore', trashedRow)
    await expect(page.getByRole('row').filter({ hasText: title })).toHaveCount(0)
  }
)
