import { randomUUID } from 'node:crypto'
import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'audit records post changes and exposes only read-only activity',
  async ({ admin, page }) => {
    const title = `Audit ${randomUUID()}`
    let recordPath: string | undefined
    try {
      await admin.login()
      await admin.gotoResource('posts')
      await page.getByRole('button', { name: 'Create', exact: true }).first().click()
      await admin.fillField('Title', title)
      await admin.fillField('Slug', title.toLowerCase().replaceAll(' ', '-'))
      await admin.fillField('Category', 'Culture')
      await page.getByRole('button', { name: 'Save post', exact: true }).click()
      await expect(page).toHaveURL(/\/posts\/\d+\/edit/)
      recordPath = new URL(page.url()).pathname.replace(/\/edit$/, '')
      // The timeline widget loads as a deferred prop: wait for it after each reload.
      await expect(async () => {
        await page.reload()
        await expect(page.getByText('model.created', { exact: true }).first()).toBeVisible({
          timeout: 3_000,
        })
      }).toPass({ timeout: 15_000 })
      await admin.fillField('Title', `${title} revised`)
      const saved = page.waitForResponse(
        (response) => response.request().method() === 'PUT' && response.url().endsWith(recordPath!)
      )
      await page.getByRole('button', { name: 'Save post', exact: true }).click()
      await saved
      await page.goto(recordPath)
      await expect(async () => {
        await page.reload()
        await expect(page.getByText('model.updated', { exact: true }).first()).toBeVisible({
          timeout: 3_000,
        })
      }).toPass({ timeout: 15_000 })
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
      await admin.gotoResource('activity')
      await expect(page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(0)
      await page.goto(
        `${recordPath.replace(/\/posts\/\d+$/, '')}/activity?filters[event][event]=model.updated&filters[auditableType][subject]=Post`
      )
      await page
        .getByRole('row')
        .filter({ hasText: recordPath.split('/').at(-1)! })
        .first()
        .getByRole('link', { name: 'model.updated', exact: true })
        .click()
      await expect(page.getByText('Old values', { exact: true })).toBeVisible()
      await expect(page.getByText('New values', { exact: true })).toBeVisible()
      await expect(
        page.getByRole('link', { name: recordPath.split('/').at(-1)!, exact: true })
      ).toHaveAttribute('href', recordPath)
      await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
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
