import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'
import { AxeBuilder } from '@axe-core/playwright'

pupitreTest('admin can update and reload Settings', async ({ admin, page }) => {
  await admin.login()
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page).toHaveURL(/\/settings$/)

  const siteName = `Settings ${Date.now()}`
  await admin.fillField('Site name', siteName)
  const maintenance = page.getByRole('switch', { name: 'Maintenance mode' })
  if (!(await maintenance.isChecked())) await maintenance.click()
  await admin.fillField('Default theme', 'Dark')
  await page.getByRole('button', { name: 'Save' }).click()
  await admin.expectToast('Saved successfully')
  await page.reload()
  await expect(page.getByLabel('Site name')).toHaveValue(siteName)
  await expect(page.getByRole('switch', { name: 'Maintenance mode' })).toBeChecked()

  await page.locator('form').evaluate((element) => {
    const form = element as unknown as { noValidate: boolean }
    form.noValidate = true
  })
  await page.getByLabel('Site name').fill('')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText(/must be defined/i).first()).toBeVisible()
})

pupitreTest(
  'workspace settings remain isolated across tenants after reload',
  async ({ admin, page }) => {
    await admin.login()
    await page.goto('/admin/acme/settings-workspace')
    await page.getByLabel('Workspace name').fill('Acme newsroom')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await admin.expectToast('Saved successfully')
    await page.goto('/admin/globex/settings-workspace')
    await expect(page.getByLabel('Workspace name')).not.toHaveValue('Acme newsroom')
    await page.getByLabel('Workspace name').fill('Globex newsroom')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await admin.expectToast('Saved successfully')
    await page.reload()
    await expect(page.getByLabel('Workspace name')).toHaveValue('Globex newsroom')
    await page.goto('/admin/acme/settings-workspace')
    await expect(page.getByLabel('Workspace name')).toHaveValue('Acme newsroom')
  }
)

pupitreTest(
  'settings pages are accessible in light, dark and mobile layouts',
  async ({ admin, page }) => {
    await admin.login()
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 })
        for (const path of ['settings', 'settings-workspace']) {
          await page.goto(`/admin/acme/${path}`)
          await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
          await page.evaluate(
            'Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {})))'
          )
          const results = await new AxeBuilder({ page: page as never })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze()
          expect(
            results.violations.filter((violation) =>
              ['serious', 'critical'].includes(violation.impact ?? '')
            )
          ).toEqual([])
        }
      }
    }
  }
)
