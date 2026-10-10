import { pupitreTest, expect } from './fixtures/pupitre_test.js'

pupitreTest('rich editor persists formatted sanitized HTML', async ({ admin, page }) => {
  await admin.login()
  await page.goto('/admin/posts/1/edit')
  const editor = page.locator('[contenteditable="true"]').first()
  await editor.fill('Sanitized editorial text')
  await editor.press('Control+A')
  await editor.press('Control+B')
  await editor.evaluate((element) => {
    const editable = element as unknown as {
      innerHTML: string
      dispatchEvent(event: unknown): boolean
    }
    const browserEvent = globalThis as unknown as {
      Event: new (type: string, options: { bubbles: boolean }) => unknown
    }
    editable.innerHTML = '<p><strong>Safe</strong><img src="x" onerror="alert(1)"></p>'
    editable.dispatchEvent(new browserEvent.Event('input', { bubbles: true }))
  })
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' && new URL(response.url()).pathname === '/admin/posts/1'
  )
  await page.getByRole('button', { name: 'Save' }).click()
  await saved
  const postId = page.url().match(/posts\/(\d+)/)?.[1]
  expect(postId).toBeTruthy()
  await page.goto(`/admin/posts/${postId}`)
  await expect(page.getByText('Safe', { exact: false })).toBeVisible()
  await expect(page.locator('[onerror]')).toHaveCount(0)
  await expect(page.locator('strong')).toContainText('Safe')
})
