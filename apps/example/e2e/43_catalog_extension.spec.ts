import { randomUUID } from 'node:crypto'
import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'
import { AxeBuilder } from '@axe-core/playwright'

pupitreTest(
  'custom rating persists across forms, repeaters, table cells, entries and actions',
  async ({ admin, page }) => {
    const title = `Rating ${randomUUID().slice(0, 8)}`
    let editPath: string | undefined
    try {
      await admin.login()
      await admin.gotoResource('comments', '/create')
      await admin.fillField('Title', title)
      await admin.fillField('Body', 'Catalog extension example')
      const rating = page.getByRole('group', { name: 'Rating', exact: true })
      await rating.getByRole('radio', { name: 'No rating', exact: true }).focus()
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowRight')
      await expect(rating.getByRole('radio', { name: '2 of 5 stars' })).toBeChecked()
      const target = await rating.getByRole('radio', { name: '2 of 5 stars' }).boundingBox()
      expect(target?.width).toBeGreaterThanOrEqual(24)
      expect(target?.height).toBeGreaterThanOrEqual(24)
      await page.getByRole('button', { name: 'Add criterion', exact: true }).click()
      await admin.fillField('Criterion', 'Clarity')
      await page
        .getByRole('group', { name: 'Criterion rating', exact: true })
        .getByRole('radio', { name: '4 of 5 stars' })
        .check()
      await page.getByRole('button', { name: 'Create Comment', exact: true }).click()
      await expect(page).toHaveURL(/\/comments\/\d+\/edit$/)
      editPath = new URL(page.url()).pathname
      await page.reload()
      await expect(
        page
          .getByRole('group', { name: 'Rating', exact: true })
          .getByRole('radio', { name: '2 of 5 stars' })
      ).toBeChecked()
      await expect(page.getByRole('textbox', { name: 'Criterion', exact: true })).toHaveValue(
        'Clarity'
      )
      await expect(
        page
          .getByRole('group', { name: 'Criterion rating', exact: true })
          .getByRole('radio', { name: '4 of 5 stars' })
      ).toBeChecked()

      await page.goto(editPath.replace(/\/edit$/, ''))
      await expect(page.getByRole('img', { name: '2 of 5 stars' })).toBeVisible()
      await expect(page.getByRole('img', { name: '4 of 5 stars' })).toBeVisible()
      await admin.gotoResource('comments')
      await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(title)
      await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter')
      const row = admin.row(title)
      await expect(row.getByRole('img', { name: '2 of 5 stars' })).toBeVisible()
      await admin.openAction('Rate comment', row)
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('radio', { name: '5 of 5 stars' }).check()
      // The server validates extension fields even if the browser payload is forged.
      await page.route('**/comments/*/actions/rate-comment', async (route) => {
        if (route.request().method() !== 'POST') return route.continue()
        const body = route.request().postDataJSON() as { data: Record<string, unknown> }
        await route.continue({
          postData: JSON.stringify({ ...body, data: { ...body.data, rating: 6 } }),
        })
      })
      await admin.submitModal('Save rating')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByText(/rating.*(greater than|less than|maximum|max)/i)).toBeVisible()
      await page.unroute('**/comments/*/actions/rate-comment')
      await admin.submitModal('Save rating')
      await expect(dialog).not.toBeVisible()
      await expect(row.getByRole('img', { name: '5 of 5 stars' })).toBeVisible()
      await page.goto(editPath.replace(/\/edit$/, ''))
      await expect(page.getByRole('img', { name: '5 of 5 stars' })).toBeVisible()
    } finally {
      await page.unroute('**/comments/*/actions/rate-comment')
      if (editPath) {
        await page.goto(editPath)
        await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible()
        await admin.openAction('Delete')
        await admin.submitModal('Delete')
        await expect(page).toHaveURL(/\/comments(?:\?.*)?$/)
      }
    }
  }
)

pupitreTest(
  'rating controls remain accessible under strict CSP in light, dark and mobile layouts',
  async ({ admin, page }) => {
    await admin.login()
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 })
        const response = await page.goto('/admin/acme/comments/create')
        expect(response?.headers()['content-security-policy']).not.toContain("'unsafe-eval'")
        await page.evaluate(
          colorScheme === 'dark'
            ? "document.documentElement.classList.add('dark')"
            : "document.documentElement.classList.remove('dark')"
        )
        const rating = page.getByRole('group', { name: 'Rating', exact: true })
        await expect(rating.getByRole('radio', { name: 'No rating' })).toBeChecked()
        const box = await rating.getByRole('radio', { name: '5 of 5 stars' }).boundingBox()
        expect(box?.width).toBeGreaterThanOrEqual(24)
        expect(box?.height).toBeGreaterThanOrEqual(24)
        expect(
          await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        ).toBe(true)
        await page.evaluate(
          'Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {})))'
        )
        const results = await new AxeBuilder({ page: page as never })
          .include('fieldset')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
        expect(results.violations).toEqual([])
      }
    }
  }
)
