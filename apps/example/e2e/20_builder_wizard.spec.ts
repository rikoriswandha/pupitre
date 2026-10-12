import { expect, pupitreTest } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'create posts with typed content blocks and navigate action wizard validation',
  async ({ admin, page }) => {
    await admin.login()
    await page.getByRole('button', { name: 'Create' }).first().click()
    const nonce = Date.now()
    await admin.fillField('Title', `Builder wizard ${nonce}`)
    await admin.fillField('Slug', `builder-wizard-${nonce}`)
    await admin.fillField('Category', 'Culture')
    // Block types live in the "Add block" menu.
    await page.getByRole('button', { name: 'Add block', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Add block Paragraph' }).click()
    await page.getByRole('button', { name: 'Add block', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Add block Heading' }).click()
    await page.getByRole('button', { name: 'Move block 2 up' }).click()
    await page.getByRole('button', { name: 'Remove block 2' }).click()
    await admin.fillField('Heading text', 'A typed heading block')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Save post' }).click()
    await expect(page).toHaveURL(/\/admin\/acme\/posts\/\d+\/edit/)
    await expect(page.getByLabel('Heading text')).toHaveValue('A typed heading block')
    await admin.expectToast('created')

    await page.goto(`/admin/acme/posts?q=${encodeURIComponent(`Builder wizard ${nonce}`)}`)
    await admin.openAction('Publish', admin.row(`Builder wizard ${nonce}`))
    const publishDate = page.getByLabel('Publish at')
    await publishDate.fill('')
    await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Publish post', exact: true })
      .click()
    await expect(page.getByLabel('Publish at')).toBeVisible()
    await expect(
      page.getByRole('dialog').getByText('The publishedAt field must be defined')
    ).toBeVisible()

    await page.getByLabel('Publish at').fill('2027-01-01T10:00')
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(
      page.getByRole('checkbox', { name: 'Notify subscribers', exact: true })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByLabel('Publish at')).toBeVisible()
  }
)
