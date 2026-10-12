import { test, expect } from '@playwright/experimental-ct-react'
import {
  CodeEditorBoundStory,
  CodeEditorReadonlyStory,
  MarkdownEditorA11yStory,
  MarkdownEditorStory,
  UploadStory,
} from './stories/catalog.story.js'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3S8AAAAASUVORK5CYII=',
  'base64'
)

test('Markdown editor updates state and previews sanitized Markdown', async ({ mount }) => {
  const view = await mount(<MarkdownEditorStory />)
  const editor = view.getByLabel('Markdown editor', { exact: true })
  await editor.fill('# Preview\n<script>alert(1)</script>\n[unsafe](javascript:alert(1))')
  await view.getByRole('button', { name: 'Preview' }).click()
  await expect(view.getByRole('heading', { name: 'Preview' })).toBeVisible()
  await expect(view.locator('script')).toHaveCount(0)
  await expect(view.locator('a[href^="javascript:"]')).toHaveCount(0)
  await view.getByRole('button', { name: 'Write' }).click()
  await expect(editor).toContainText('[unsafe]')
})

test('CodeMirror editor accepts source edits', async ({ mount }) => {
  const view = await mount(<CodeEditorBoundStory />)
  const editor = view.locator('.cm-content')
  await expect(editor).toBeVisible()
  await editor.fill('{"enabled": true}')
  await expect(editor).toContainText('{"enabled": true}')
  const boundValue = await view.evaluate(() => {
    const store = (window as Window & { __ctPupitreStore?: { get(path: string): unknown } })
      .__ctPupitreStore
    return store?.get('/data/config')
  })
  expect(boundValue).toBe('{"enabled": true}')
  await view.getByRole('button', { name: 'Set external value' }).click()
  await expect(editor).toContainText('{"external":true}')
})
test('CodeMirror enforces read-only contenteditable semantics', async ({ mount }) => {
  const view = await mount(<CodeEditorReadonlyStory />)
  await expect(view.locator('.cm-content')).toHaveAttribute('contenteditable', 'false')
  await expect(view.locator('.cm-content')).toHaveAttribute('aria-readonly', 'true')
})
test('CodeMirror marks disabled editor content accessibly', async ({ mount }) => {
  const view = await mount(<CodeEditorReadonlyStory disabled />)
  await expect(view.locator('.cm-content')).toHaveAttribute('contenteditable', 'false')
  await expect(view.locator('.cm-content')).toHaveAttribute('aria-disabled', 'true')
})

test('FileUpload image editor crops before uploading the resulting file', async ({
  mount,
  page,
}) => {
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  let uploadedBody: Buffer | undefined
  await page.route('**/upload', async (route) => {
    if (route.request().method() === 'POST')
      uploadedBody = route.request().postDataBuffer() ?? undefined
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        key: 'cropped-key',
        url: '/cropped.png',
        name: 'cover.png',
        size: 10,
        mime: 'image/png',
      }),
    })
  })
  const view = await mount(<UploadStory />)
  await view
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: png })
  const cropPanel = page.getByRole('dialog', { name: 'Edit image' })
  await expect(cropPanel).toBeVisible()
  await cropPanel.getByRole('button', { name: 'Rotate' }).click()
  await cropPanel.getByRole('button', { name: 'Flip' }).click()
  await cropPanel.getByRole('button', { name: 'Apply crop' }).click()
  await expect.poll(() => uploadedBody?.length ?? 0).toBeGreaterThan(png.byteLength)
  expect(uploadedBody?.includes(png)).toBe(false)
  await expect(view.getByRole('img', { name: 'cover.png' })).toBeVisible()
})
test('Markdown editor associates its label, helper text, and validation error', async ({
  mount,
}) => {
  const view = await mount(<MarkdownEditorA11yStory />)
  const editor = view.getByRole('textbox', { name: 'Body' })
  await expect(editor).toHaveAttribute('aria-invalid', 'true')
  const describedBy = await editor.getAttribute('aria-describedby')
  expect(describedBy).toContain('helper')
  expect(describedBy).toContain('error')
  await expect(view.getByText('Write Markdown content.')).toBeVisible()
  await expect(view.getByRole('alert')).toHaveText('Required')
})
