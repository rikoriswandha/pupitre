import { readFile } from 'node:fs/promises'
import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'OR query survives reload and exports only scoped matching posts',
  async ({ admin, page }) => {
    await admin.login()
    const query = JSON.stringify({
      groups: [
        [{ constraint: 'title', operator: 'endsWith', value: '01' }],
        [{ constraint: 'title', operator: 'endsWith', value: '03' }],
      ],
    })
    const params = new URLSearchParams({ 'filters[query]': query, 'sort': '-title' })
    await page.goto(`/admin/acme/posts?${params}`)
    const matchingRows = page.getByRole('row').filter({ hasText: /Field Notes 0[13]/ })
    await expect(matchingRows).toHaveCount(2)
    await expect(page.getByRole('row').filter({ hasText: 'Field Notes 02' })).toHaveCount(0)
    await expect(page.getByRole('row').filter({ hasText: 'Globex' })).toHaveCount(0)
    await page.reload()
    await expect(matchingRows).toHaveCount(2)
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await expect(page.getByLabel('Group 1, rule 1: value', { exact: true })).toHaveValue('01')
    await expect(page.getByLabel('Group 2, rule 1: value', { exact: true })).toHaveValue('03')
    await page.keyboard.press('Escape')

    const downloadEvent = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export', exact: true }).first().click()
    const download = await downloadEvent
    const downloadPath = await download.path()
    expect(downloadPath).not.toBeNull()
    const csv = await readFile(downloadPath!, 'utf8')
    expect(csv).toContain('FIELD NOTES 01')
    expect(csv).toContain('FIELD NOTES 03')
    expect(csv).not.toContain('FIELD NOTES 02')
    expect(csv).not.toContain('Globex')
    expect(csv.indexOf('FIELD NOTES 03')).toBeLessThan(csv.indexOf('FIELD NOTES 01'))
  }
)

pupitreTest('query editor and multi-sort work with the keyboard', async ({ admin, page }) => {
  await admin.login()
  await page.goto('/admin/acme/posts')
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await page.getByRole('button', { name: 'Add rule group', exact: true }).click()
  const value = page.getByLabel('Group 1, rule 1: value', { exact: true })
  await value.fill('Field Notes 01')
  await page.getByRole('button', { name: 'Add OR group', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByLabel('Group 2, rule 1: value', { exact: true }).fill('Field Notes 03')
  await page.getByRole('button', { name: 'Apply', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('row').filter({ hasText: 'Field Notes 01' })).toHaveCount(1)
  await expect(page.getByRole('row').filter({ hasText: 'Field Notes 03' })).toHaveCount(1)
  await expect(page.getByRole('row').filter({ hasText: 'Field Notes 02' })).toHaveCount(0)
  await expect(page).toHaveURL(/filters/)

  await page.goto('/admin/acme/posts?sort=title')
  await page.getByRole('button', { name: 'Add Category to sort', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => new URL(page.url()).searchParams.get('sort')).toBe('title,category.name')
  await page.reload()
  await expect(page.getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
    'aria-sort',
    'ascending'
  )
  await expect(page.getByRole('columnheader', { name: /Category/ })).not.toHaveAttribute(
    'aria-sort'
  )
  await page.getByRole('button', { name: 'Clear sorting', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => new URL(page.url()).searchParams.get('sort')).toBe('')
  await page.reload()
  await expect(page.getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
    'aria-sort',
    'none'
  )
  await expect(page.locator('th[aria-sort]:not([aria-sort="none"])')).toHaveCount(0)
})

pupitreTest(
  'query builder stays usable in light, dark and mobile layouts',
  async ({ admin, page }) => {
    await admin.login()
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      await page.setViewportSize({ width: colorScheme === 'dark' ? 390 : 1280, height: 844 })
      await page.goto('/admin/acme/products')
      await page.evaluate(
        `document.documentElement.classList.toggle('dark', ${colorScheme === 'dark'})`
      )
      await page.getByRole('button', { name: 'Filters', exact: true }).click()
      await page.getByRole('button', { name: 'Add rule group', exact: true }).click()
      const constraint = page.getByRole('combobox', {
        name: 'Group 1, rule 1: constraint',
        exact: true,
      })
      await expect(constraint).toBeVisible()
      await constraint.focus()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Escape')
      const apply = page.getByRole('button', { name: 'Apply query', exact: true })
      await expect(apply).toBeInViewport()
      const box = await apply.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    }
  }
)
