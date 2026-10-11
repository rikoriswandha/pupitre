import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3S8AAAAASUVORK5CYII=',
  'base64'
)

pupitreTest(
  'Markdown, CodeMirror and image editing work through the admin form',
  async ({ admin, page }) => {
    await admin.login()
    await page.goto('/admin/acme/posts/create')
    const unique = Date.now()
    await page.getByLabel('Title').fill(`Editors ${unique}`)
    await page.getByLabel('Slug').fill(`editors-${unique}`)
    await page.getByRole('textbox', { name: 'Category', exact: true }).click()
    await page.getByRole('option', { name: 'Culture' }).click()

    await page.getByRole('tab', { name: 'Content' }).click()
    const markdown = page.getByRole('textbox', { name: 'Summary', exact: true })
    await markdown.fill(
      '## Safe preview\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))'
    )
    await page.getByRole('button', { name: 'Preview' }).click()
    await expect(page.getByRole('heading', { name: 'Safe preview', level: 2 })).toBeVisible()
    const preview = page
      .locator('.prose')
      .filter({ has: page.getByRole('heading', { name: 'Safe preview', level: 2 }) })
    await expect(preview.locator('script')).toHaveCount(0)
    await expect(preview.locator('a[href^="javascript:"]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Write' }).click()

    await page.getByRole('tab', { name: 'Media' }).click()
    const uploadResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().includes('/_pupitre/upload')
    )
    await page
      .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
      .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: png })
    await expect(page.getByRole('dialog', { name: 'Edit image' })).toBeVisible()
    await page.getByRole('button', { name: 'Apply crop' }).click()
    await uploadResponse
    await expect(page.getByRole('img', { name: 'cover.png' })).toBeVisible()

    await page.getByRole('button', { name: 'Save post' }).click()
    await expect(page).toHaveURL(/\/admin\/acme\/posts\/\d+\/edit/)
    const postId = page.url().match(/posts\/(\d+)\/edit/)?.[1]
    expect(postId).toBeTruthy()
    await page.goto(`/admin/acme/posts/${postId}`)
    await expect(page.getByRole('heading', { name: 'Safe preview', level: 2 })).toBeVisible()
    await expect(page.locator('main script')).toHaveCount(0)

    await page.goto('/admin/acme/settings')
    const codeEditor = page.locator('.cm-content').first()
    await codeEditor.fill('{"editor": "CodeMirror"}')
    await page.getByRole('button', { name: 'Save' }).click()
    await admin.expectToast('Saved successfully')
    await expect(page.locator('.cm-content').first()).toContainText('CodeMirror')
  }
)
