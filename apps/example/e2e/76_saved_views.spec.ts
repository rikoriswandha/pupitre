import { randomUUID } from 'node:crypto'
import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'saved views save, apply, default and delete a personal Posts view',
  async ({ admin, page }) => {
    await admin.login()
    await admin.gotoResource('posts')
    const name = `Editorial ${randomUUID().slice(0, 8)}`
    await page.getByRole('button', { name: 'Views', exact: true }).click()
    await page.getByRole('button', { name: 'Drafts', exact: true }).click()
    await expect(page).toHaveURL(/status%5D=draft/)
    await page.getByRole('button', { name: 'Views', exact: true }).click()
    await page.getByRole('button', { name: 'Save current view', exact: true }).click()
    await page.getByLabel('View name', { exact: true }).fill(name)
    await page.getByRole('button', { name: 'Save view', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'View name', exact: true })).not.toBeVisible()
    await page.getByRole('button', { name: 'Views', exact: true }).click()
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page).toHaveURL(/view=[a-f0-9-]+/)
    await page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem('pupitre:columns:admin.posts') ?? '{}')
      localStorage.setItem(
        'pupitre:columns:admin.posts',
        JSON.stringify({ ...stored, viewsCount: true })
      )
    })
    await page.reload()
    await expect(page.getByRole('button', { name: 'Views', exact: true })).toBeVisible()
    await expect(
      page.getByRole('searchbox', { name: 'Search Views', exact: true })
    ).not.toBeVisible()
    await page.getByRole('button', { name: 'Views', exact: true }).click()
    await page.getByRole('button', { name: 'Set default view', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Unset default view', exact: true })
    ).toBeVisible()
    await admin.gotoResource('posts')
    await expect(page).toHaveURL(/view=[a-f0-9-]+/)
    await page.getByRole('button', { name: 'Views', exact: true }).click()
    await page.getByRole('button', { name: 'Delete view', exact: true }).click()
    await page.getByRole('button', { name: 'Delete view', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Delete view', exact: true })).not.toBeVisible()
    await page.getByRole('button', { name: 'Views', exact: true }).click()
    await expect(page.getByRole('button', { name, exact: true })).not.toBeVisible()
  }
)
