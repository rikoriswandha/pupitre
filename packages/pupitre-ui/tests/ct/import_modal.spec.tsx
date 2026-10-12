import { test, expect } from '@playwright/experimental-ct-react'
import { ImportModalDialogStory, ImportModalStory } from './stories/import_modal.story.js'

test('imports CSV mappings with asynchronous progress', async ({ mount, page }) => {
  const view = await mount(<ImportModalStory />)
  await page.evaluate(() => {
    window.fetch = async (input) => {
      const url = String(input)
      const response = url.includes('/preview')
        ? {
            headers: ['Post title', 'Slug'],
            preview: [{ 'Post title': 'A post', 'Slug': 'a-post' }],
            fields: [
              { name: 'title', label: 'Title', required: true },
              { name: 'slug', label: 'Slug', required: true },
            ],
          }
        : url.includes('/_pupitre/exports/')
          ? {
              id: 'job1',
              status: 'done',
              totalRows: 2,
              processedRows: 2,
              createdRows: 1,
              updatedRows: 0,
              failedRows: 1,
              failedRowsUrl: '/admin/_pupitre/exports/failed/download',
            }
          : { jobId: 'job1', progressUrl: '/admin/_pupitre/exports/job1' }
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  })
  try {
    const fileInput = page.locator('#pupitre-import-file')
    await expect(fileInput).toHaveAttribute('type', 'file')
    await fileInput.setInputFiles({
      name: 'posts.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Post title,Slug\nA post,a-post\n'),
    })
    expect(
      await fileInput.evaluate((element) => (element as HTMLInputElement).files?.[0]?.name)
    ).toBe('posts.csv')
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled({ timeout: 2000 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Post title', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Import CSV' }).click()
    await expect(page.getByText('1 created, 0 updated, 1 failed.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Download failed rows CSV' })).toHaveAttribute(
      'href',
      '/admin/_pupitre/exports/failed/download'
    )
  } finally {
    if (!page.isClosed()) await view.unmount()
  }
})
test('import modal traps focus, closes on Escape, and restores focus to its trigger', async ({
  mount,
  page,
}) => {
  await mount(<ImportModalDialogStory />)
  const trigger = page.getByRole('button', { name: 'Open import' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Import CSV' })
  await expect(dialog).toBeVisible()
  await expect(page.locator('#pupitre-import-file')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

test('CSV read failures and complete preview/progress messages honor Indonesian translations', async ({
  mount,
  page,
}) => {
  await mount(<ImportModalStory locale="id" />)
  await page.evaluate(() => {
    window.fetch = async () => {
      throw 'offline'
    }
  })
  await page.locator('#pupitre-import-file').setInputFiles({
    name: 'posts.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Title,Slug\nPost,post\n'),
  })
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
  await expect(page.getByText('Gagal membaca file CSV.')).toBeVisible()
  await page.evaluate(() => {
    window.fetch = async (input) => {
      const url = String(input)
      const response = url.includes('/preview')
        ? {
            headers: ['Title', 'Slug'],
            preview: [{ Title: 'Post', Slug: 'post' }],
            fields: [
              { name: 'title', label: 'Title', required: true },
              { name: 'slug', label: 'Slug', required: true },
            ],
          }
        : url.includes('/progress')
          ? { id: 'job1', status: 'processing', totalRows: 1, processedRows: 0 }
          : { jobId: 'job1', progressUrl: '/progress' }
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  })
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()
  await expect(page.getByText('Kolom 2, baris 1')).toBeVisible()
  await page.getByRole('button', { name: 'Impor CSV', exact: true }).click()
  await expect(page.getByText('Progres impor: 0 / 1', { exact: true })).toBeVisible()
})
