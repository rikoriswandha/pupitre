import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'calendar keyboard move persists a publication date in the resource',
  async ({ admin, page }) => {
    await admin.login()
    await page.goto('/admin/acme/posts/1/edit')
    const title = await page.getByRole('textbox', { name: 'Title', exact: true }).inputValue()
    const original = await page.getByLabel('Published at', { exact: true }).inputValue()
    const date = new Date().toISOString().slice(0, 10)
    const next = `${date}T11:45`
    try {
      // Bring the seeded post into the current visible month without relying on clock-specific seeds.
      await page.getByLabel('Published at', { exact: true }).fill(`${date}T09:00`)
      const save = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          new URL(response.url()).pathname === '/admin/acme/posts/1'
      )
      await page.getByRole('button', { name: 'Save post', exact: true }).click()
      await save
      await page.goto('/admin/acme/calendar')
      const move = page.getByRole('button', { name: `Move ${title}`, exact: true })
      await expect(move).toBeVisible()
      await move.focus()
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('Start', { exact: true }).fill(next)
      await dialog.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(dialog).not.toBeVisible()
      await page.goto('/admin/acme/posts/1/edit')
      await expect(page.getByLabel('Published at', { exact: true })).toHaveValue(next)
    } finally {
      await page.goto('/admin/acme/posts/1/edit')
      await page.getByLabel('Published at', { exact: true }).fill(original)
      const restore = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          new URL(response.url()).pathname === '/admin/acme/posts/1'
      )
      await page.getByRole('button', { name: 'Save post', exact: true }).click()
      await restore
    }
  }
)
