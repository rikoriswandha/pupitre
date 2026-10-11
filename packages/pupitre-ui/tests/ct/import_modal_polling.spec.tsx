import { test, expect } from '@playwright/experimental-ct-react'
import { ImportModalDialogStory } from './stories/import_modal.story.js'

for (const dismissal of ['Cancel', 'Escape'] as const) {
  test(`queued import allows ${dismissal}, aborts polling and announces background continuation`, async ({
    mount,
    page,
  }) => {
    await page.clock.install()
    await mount(<ImportModalDialogStory />)
    await page.evaluate(() => {
      const state = window as Window & { __importPolls?: number; __importAborts?: number }
      state.__importPolls = 0
      state.__importAborts = 0
      window.fetch = async (input, options) => {
        const url = String(input)
        const reply = (payload: unknown) =>
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        if (url.includes('/preview'))
          return reply({
            headers: ['title'],
            preview: [{ title: 'A post' }],
            fields: [{ name: 'title', label: 'Title', required: true }],
          })
        if (!url.includes('/_pupitre/exports/'))
          return reply({
            jobId: 'queued-import',
            progressUrl: '/admin/_pupitre/exports/queued-import',
          })
        state.__importPolls = (state.__importPolls ?? 0) + 1
        if (state.__importPolls === 1)
          return reply({
            id: 'queued-import',
            status: 'processing',
            totalRows: 2,
            processedRows: 1,
          })
        return new Promise<Response>((_resolve, reject) => {
          const abort = () => {
            state.__importAborts = (state.__importAborts ?? 0) + 1
            reject(new DOMException('Aborted', 'AbortError'))
          }
          if (options?.signal?.aborted) abort()
          else options?.signal?.addEventListener('abort', abort, { once: true })
        })
      }
    })
    await page.getByRole('button', { name: 'Open import' }).click()
    await page.locator('#pupitre-import-file').setInputFiles({
      name: 'posts.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('title\nA post\n'),
    })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Import CSV', exact: true }).click()
    await expect(page.getByText('Import progress: 1 / 2')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled()
    await page.clock.fastForward(1500)
    await expect
      .poll(() =>
        page.evaluate(() => (window as Window & { __importPolls?: number }).__importPolls)
      )
      .toBe(2)
    if (dismissal === 'Escape') await page.keyboard.press('Escape')
    else await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Import CSV' })).not.toBeVisible()
    await expect(
      page.getByRole('status').filter({ hasText: 'Import continues in background' })
    ).toHaveCount(1)
    await expect
      .poll(() =>
        page.evaluate(() => (window as Window & { __importAborts?: number }).__importAborts)
      )
      .toBe(1)
    await page.clock.fastForward(10_000)
    expect(
      await page.evaluate(() => (window as Window & { __importPolls?: number }).__importPolls)
    ).toBe(2)
    await expect(page.getByLabel('Completed imports')).toHaveText('0')
    await page.getByRole('button', { name: 'Open import' }).click()
    await expect(page.getByRole('button', { name: 'Import CSV', exact: true })).toBeEnabled()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}
