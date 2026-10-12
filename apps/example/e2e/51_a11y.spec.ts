import { randomUUID } from 'node:crypto'
import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

async function audit(page: Page, surface: string) {
  const results = await new AxeBuilder({ page: page as never })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    ),
    `${surface}: serious/critical WCAG 2.1 A/AA violations`
  ).toEqual([])
}

pupitreTest(
  'release accessibility audit covers auth, CRUD, audit and account surfaces',
  async ({ admin, page }) => {
    pupitreTest.setTimeout(120_000)
    let recordPath: string | undefined
    try {
      await page.goto('/admin/login')
      await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
      await audit(page, 'login')
      await admin.login()
      await page.goto('/admin/acme/')
      await expect(page.getByRole('heading', { name: 'Posts by status' })).toBeVisible()
      await audit(page, 'dashboard')
      await admin.gotoResource('posts')
      await expect(page.getByRole('table').first()).toBeVisible()
      await audit(page, 'posts list')
      await page.getByRole('button', { name: 'Create', exact: true }).first().click()
      await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible()
      await audit(page, 'post create')
      const title = `Accessibility ${randomUUID()}`
      await admin.fillField('Title', title)
      await admin.fillField('Slug', title.toLowerCase().replaceAll(' ', '-'))
      await admin.fillField('Category', 'Culture')
      await page.getByRole('button', { name: 'Save post', exact: true }).click()
      await expect(page).toHaveURL(/\/posts\/\d+\/edit/)
      recordPath = new URL(page.url()).pathname.replace(/\/edit$/, '')
      await audit(page, 'post edit')
      await page.goto(recordPath)
      await expect(async () => {
        await page.reload()
        await expect(page.getByText('model.created', { exact: true }).first()).toBeVisible({
          timeout: 3_000,
        })
      }).toPass({ timeout: 15_000 })
      await audit(page, 'post view with timeline')
      await page.goto('/admin/acme/roles/create')
      await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible()
      await expect(page.getByRole('checkbox', { name: 'View', exact: true }).first()).toBeVisible()
      await audit(page, 'role create permissions')
      await admin.gotoResource('activity')
      await expect(page.getByRole('table').first()).toBeVisible()
      await audit(page, 'activity list')
      await page
        .getByRole('row')
        .filter({ hasText: recordPath.split('/').at(-1)! })
        .first()
        .getByRole('link', { name: 'model.created', exact: true })
        .click()
      await expect(page.getByText('New values', { exact: true })).toBeVisible()
      await audit(page, 'activity view')
      await page.goto('/admin/acme/settings')
      await expect(page.getByLabel('Site name')).toBeVisible()
      await audit(page, 'settings')
      await page.goto('/admin/acme/settings-workspace')
      await expect(page.getByLabel('Workspace name')).toBeVisible()
      await audit(page, 'tenant settings')
      await page.goto('/admin/profile')
      await expect(page.getByLabel('Passkey name')).toBeVisible()
      await audit(page, 'profile security')
    } finally {
      if (recordPath) {
        await page.goto(`${recordPath}/edit`)
        await admin.openAction('Delete')
        await page
          .getByRole('button', { name: /delete|confirm/i })
          .last()
          .click()
        await expect(page).toHaveURL(/\/posts(?:\?.*)?$/)
      }
    }
  }
)
