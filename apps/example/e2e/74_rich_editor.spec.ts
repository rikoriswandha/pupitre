import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'Posts rich editor resolves merge tags, scoped user mentions, and editable callouts',
  async ({ admin, page }) => {
    await admin.login()
    await page.goto('/admin/acme/posts/1/edit')
    const editor = page.getByRole('textbox', { name: 'Body', exact: true })
    await expect(editor).toBeVisible()
    await editor.fill('Hello ')
    await editor.press('End')
    await editor.pressSequentially('{{')
    await expect(page.getByRole('option', { name: 'Customer name' })).toBeVisible()
    await editor.press('Enter')
    const searched = page.waitForResponse(
      (response) =>
        response.url().includes('/_pupitre/options/posts/body') &&
        response.url().includes('mention=')
    )
    await editor.pressSequentially('@Admin')
    const response = await searched
    expect(response.status()).toBe(200)
    const suggestions = page.getByRole('listbox', { name: 'Suggestions' })
    await expect(suggestions.getByRole('option').first()).toBeVisible()
    await editor.press('Enter')
    await expect(editor.locator('[data-type="mention"]')).toHaveCount(1)
    await page.getByRole('button', { name: 'Insert block' }).click()
    await page.getByRole('menuitem', { name: 'Callout' }).click()
    const dialog = page.getByRole('dialog', { name: 'Callout' })
    await dialog.getByRole('textbox', { name: 'Callout title' }).fill('Rich editor callout')
    await dialog.getByRole('combobox', { name: 'Tone' }).click()
    await page.getByRole('option', { name: 'Information', exact: true }).click()
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click()
    await page.getByRole('button', { name: 'Edit block' }).click()
    await dialog.getByRole('textbox', { name: 'Callout title' }).fill('Updated rich editor callout')
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click()
    const saved = page.waitForResponse(
      (result) =>
        result.request().method() === 'PUT' &&
        new URL(result.url()).pathname === '/admin/acme/posts/1'
    )
    await page.getByRole('button', { name: 'Save post', exact: true }).click()
    const saveResponse = await saved
    expect(saveResponse.status()).toBeLessThan(400)
    await expect(page.getByRole('button', { name: 'Save post', exact: true })).toBeEnabled()
    await page.goto('/admin/acme/posts/1')
    await expect(page.locator('main')).toContainText('Pupitre reader')
    await expect(page.locator('main')).toContainText('Information: Updated rich editor callout')
    await expect(page.locator('main [data-type="mention"]')).toHaveCount(1)
    await expect(
      page.locator('main [data-type="mergeTag"], main [data-type="customBlock"]')
    ).toHaveCount(0)
  }
)
