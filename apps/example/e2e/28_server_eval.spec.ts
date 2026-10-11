import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'server-evaluated title updates generate a normalized slug',
  async ({ admin, page }) => {
    await admin.login()
    await page.getByRole('button', { name: 'Create' }).first().click()
    await admin.fillField('Title', '  Café & Garden  ')
    await expect(page.getByLabel('Slug')).toHaveValue('cafe-garden')
  }
)
