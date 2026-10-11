import { pupitreTest, expect, AdminPage } from '@rikology/pupitre-ui/testing'
import { examplePanel } from './panel.js'

pupitreTest(
  'field helpers ignore inline table edit buttons while a form is loading',
  async ({ page }) => {
    await page.setContent(
      '<button aria-label="Edit Title, Existing post, row 1">Existing post</button>'
    )
    const admin = new AdminPage(page, examplePanel)
    const filling = admin.fillField('Title', 'New post')
    await page.locator('body').evaluate((element) => {
      const body = element as unknown as {
        insertAdjacentHTML(position: 'beforeend', html: string): void
      }
      body.insertAdjacentHTML(
        'beforeend',
        '<form><label>Title <input name="title" /></label></form>'
      )
    })
    await filling
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('New post')
    await expect(page.getByRole('button')).toHaveText('Existing post')
  }
)
