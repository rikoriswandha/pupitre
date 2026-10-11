import { AdminPage, pupitreTest, expect } from '@rikology/pupitre-ui/testing'
import { examplePanel } from './panel.js'

pupitreTest('renders the same stored instant in each user timezone', async ({ admin, page }) => {
  await admin.login()
  await admin.gotoResource('posts/1')
  await expect(page.getByText('2026 Oct 07, 19:00')).toBeVisible()

  const browser = page.context().browser()
  if (!browser) throw new Error('Playwright browser is unavailable')
  const editorContext = await browser.newContext()
  try {
    const editorPage = await editorContext.newPage()
    const editor = new AdminPage(editorPage, examplePanel)
    await editor.login('editor@example.com', 'password')
    await editor.gotoResource('posts/1')
    await expect(editorPage.getByText('2026 Oct 07, 14:00')).toBeVisible()
  } finally {
    await editorContext.close()
  }
})

pupitreTest(
  'creates a zoned publication time that another user sees as the same UTC instant',
  async ({ page }) => {
    const browser = page.context().browser()
    if (!browser) throw new Error('Playwright browser is unavailable')
    const editorContext = await browser.newContext()
    const adminContext = await browser.newContext()
    try {
      const editorPage = await editorContext.newPage()
      const editor = new AdminPage(editorPage, examplePanel)
      await editor.login('editor@example.com', 'password')
      await editorPage.getByRole('button', { name: 'Create' }).first().click()
      const unique = `${Date.now()}`
      await editor.fillField('Title', `Timezone create ${unique}`)
      await editor.fillField('Slug', `timezone-create-${unique}`)
      await editor.fillField('Status', 'Published')
      await editor.fillField('Published at', '2026-10-07T19:00')
      await editor.fillField('Category', 'Culture')
      await editorPage.getByRole('button', { name: 'Save post' }).click()
      await expect(editorPage).toHaveURL(/\/admin\/acme\/posts\/\d+\/edit/)
      await expect(await editor.field('Published at')).toHaveValue('2026-10-07T19:00')

      const recordUrl = new URL(editorPage.url()).pathname.replace(/\/edit$/, '')
      const adminPage = await adminContext.newPage()
      const otherUser = new AdminPage(adminPage, examplePanel)
      await otherUser.login()
      await adminPage.goto(recordUrl)
      await expect(adminPage.getByText('2026 Oct 08, 00:00')).toBeVisible()
    } finally {
      await editorContext.close()
      await adminContext.close()
    }
  }
)
