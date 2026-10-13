import { test, expect } from '@playwright/experimental-ct-react'
import { AxeBuilder } from '@axe-core/playwright'
import { MediaStory } from './stories/media.story.js'
import { createRequire } from 'node:module'
const qs = createRequire(import.meta.url)('qs') as {
  parse(query: string, options: { arrayLimit: number }): Record<string, unknown>
}

for (const lookup of ['cells', 'picker'] as const)
  test(`media ${lookup} chunks 25 ids using Adonis qs defaults`, async ({ mount, page }) => {
    const requests: number[][] = []
    await page.route('**/_pupitre/media?*', async (route) => {
      const parsed = qs.parse(new URL(route.request().url()).search.slice(1), { arrayLimit: 20 })
      if (!Array.isArray(parsed.ids)) {
        await route.fulfill({ status: 422, json: { errors: { ids: ['Expected array'] } } })
        return
      }
      const ids = parsed.ids.map(Number)
      requests.push(ids)
      await route.fulfill({
        json: {
          rows: ids.map((id) => ({
            id,
            filename: `Image ${id}`,
            alt: `Image ${id}`,
            mime: 'image/png',
            url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          })),
        },
      })
    })
    const view = await mount(<MediaStory lookup={lookup} />)
    await expect(view.getByRole('img')).toHaveCount(25)
    expect(requests.map((ids) => ids.length)).toEqual([20, 5])
    expect(new Set(requests.flat()).size).toBe(25)
  })

test('media chunk failures leave other cells intact and requests concurrent', async ({
  mount,
  page,
}) => {
  let release: (() => void) | undefined
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  const requests: number[][] = []
  await page.route('**/_pupitre/media?*', async (route) => {
    const parsed = qs.parse(new URL(route.request().url()).search.slice(1), { arrayLimit: 20 })
    const ids = Array.isArray(parsed.ids) ? parsed.ids.map(Number) : []
    requests.push(ids)
    if (ids.includes(1)) {
      await blocked
      await route.fulfill({ status: 500, json: {} })
    } else {
      release?.()
      await route.fulfill({
        json: {
          rows: ids.map((id) => ({
            id,
            filename: `Image ${id}`,
            alt: `Image ${id}`,
            mime: 'image/png',
            url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          })),
        },
      })
    }
  })
  const view = await mount(<MediaStory lookup="cells" />)
  await expect(view.getByRole('img')).toHaveCount(5)
  await expect(view.getByRole('alert')).toHaveCount(20)
  expect(requests.map((ids) => ids.length)).toEqual([20, 5])
})

test('media lookups discard nonpositive ids', async ({ mount, page }) => {
  const requests: number[][] = []
  await page.route('**/_pupitre/media?*', async (route) => {
    const parsed = qs.parse(new URL(route.request().url()).search.slice(1), { arrayLimit: 20 })
    const ids = Array.isArray(parsed.ids) ? parsed.ids.map(Number) : []
    requests.push(ids)
    await route.fulfill({ json: { rows: [] } })
  })
  await mount(<MediaStory lookup="invalid" />)
  await expect.poll(() => requests).toEqual([[1]])
})
test('media selection, upload, reorder and removal support keyboard and accessibility', async ({
  mount,
  page,
}) => {
  const view = await mount(<MediaStory />)
  await view.getByRole('button', { name: 'Choose media' }).focus()
  await page.keyboard.press('Enter')
  const first = view.getByRole('button', { name: 'Image 1', exact: true })
  await first.focus()
  await page.keyboard.press('Enter')
  const second = view.getByRole('button', { name: 'Image 2', exact: true })
  await second.focus()
  await page.keyboard.press('Enter')
  await expect(view.getByRole('status', { name: 'Selected media' })).toHaveText('[1,2]')
  await expect(view.getByRole('button', { name: 'Move Image 1 up', exact: true })).toBeDisabled()
  await expect(view.getByRole('button', { name: 'Move Image 2 down', exact: true })).toBeDisabled()
  await view.getByRole('button', { name: 'Move Image 2 up', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(view.getByRole('status', { name: 'Selected media' })).toHaveText('[2,1]')
  await view
    .getByLabel('Upload media')
    .setInputFiles({ name: 'upload.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  await expect(view.getByRole('status', { name: 'Selected media' })).toHaveText('[2,1,3]')
  await view.getByRole('button', { name: 'Remove Image 2', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(view.getByRole('status', { name: 'Selected media' })).toHaveText('[1,3]')
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished))
  })
  const results = await new AxeBuilder({ page: page as never })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('[data-base-ui-focus-guard]')
    .analyze()
  expect(results.violations).toEqual([])
})
