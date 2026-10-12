import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'schema parity fields render and hasMany links synchronize',
  async ({ admin, page }) => {
    await admin.login()
    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click()
    const stamp = Date.now()
    await admin.fillField('Title', `Schema parity ${stamp}`)
    await admin.fillField('Slug', `schema-parity-${stamp}`)
    await admin.fillField('Category', 'Culture')
    await expect(page.locator('[title="Use lowercase words separated by hyphens."]')).toBeVisible()
    // Hint, prefix and suffix actions render inline; the header copy sits in "More actions".
    await expect(page.getByRole('button', { name: 'Manage categories' })).toHaveCount(3)

    await admin.fillField('Phone', '2125550199')
    const phone = await admin.field('Phone')
    await expect(phone).toHaveValue('(212) 555-0199')

    const excerpt = await admin.field('Excerpt')
    const initialHeight = await excerpt.evaluate((element) => {
      // Schema guarantees this field renders as a textarea.
      const textarea = element as unknown as { style: { height: string } }
      return Number.parseFloat(textarea.style.height)
    })
    await excerpt.fill('A long summary\nthat grows\nwhen more lines are entered.')
    await expect
      .poll(() =>
        excerpt.evaluate((element) => {
          // Schema guarantees this field renders as a textarea.
          const textarea = element as unknown as { style: { height: string } }
          return Number.parseFloat(textarea.style.height)
        })
      )
      .toBeGreaterThan(initialHeight)

    const priority = page.getByRole('slider', { name: 'Priority' })
    await priority.focus()
    await priority.press('Home')
    for (let step = 0; step < 7; step++) await priority.press('ArrowRight')
    await expect(priority).toHaveAttribute('aria-valuenow', '35')

    await page.getByRole('button', { name: /add related link/i }).click()
    await admin.fillField('Label', 'Project home')
    await admin.fillField('URL', 'https://example.test/project')
    const website = await admin.field('Website')
    await website.fill('not a URL')
    await page.getByRole('button', { name: 'Save post' }).click()
    await page.getByRole('button', { name: 'Save post' }).click()
    await expect(website).toHaveAttribute('aria-invalid', 'true')
    await website.fill('https://example.test')
    await page.getByRole('button', { name: 'Save post' }).click()
    await expect(page).toHaveURL(/\/admin\/acme\/posts\/\d+\/edit/)

    await page.getByRole('button', { name: /add related link/i }).click()
    await admin.fillField('Label', 'Documentation')
    await admin.fillField('URL', 'https://example.test/docs')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByLabel('Label')).toHaveCount(2)
    await page.getByRole('button', { name: 'Remove', exact: true }).first().click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByLabel('Label')).toHaveCount(1)
  }
)
