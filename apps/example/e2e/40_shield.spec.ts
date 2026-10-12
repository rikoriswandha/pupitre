import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'editor cannot discover or open roles; super administrator manages a role',
  async ({ admin, page }) => {
    await admin.login('editor@example.com')
    await expect(page.getByRole('link', { name: /^Roles$/ })).toHaveCount(0)
    // JSON requests surface the 403; HTML visits redirect back with a "Forbidden" flash.
    const json = { headers: { Accept: 'application/json' } }
    const deniedList = await page.request.get('/admin/acme/roles', json)
    const deniedCreate = await page.request.get('/admin/acme/roles/create', json)
    expect(deniedList.status()).toBe(403)
    expect(deniedCreate.status()).toBe(403)
    await page.goto('/admin/acme/users/create')
    await expect(page.getByRole('heading', { name: 'Create User' })).toBeVisible()
    await expect(page.getByText('Roles', { exact: true })).toHaveCount(0)
    await page.goto('/admin/acme/users')
    await page
      .locator('.pupitre-table-grid article')
      .filter({ hasText: 'Editorial Editor' })
      .getByRole('button', { name: 'Edit', exact: true })
      .click()
    await expect(page.getByRole('button', { name: /^Save/ }).last()).toBeVisible()
    await expect(page.getByText('Roles', { exact: true })).toHaveCount(0)

    // Leave the app first so no in-flight response re-sets the cookie session after clearing.
    await page.goto('about:blank')
    await page.context().clearCookies()
    await admin.login('admin@example.com')
    await page.getByRole('link', { name: /^Roles$/ }).click()
    await expect(page).toHaveURL('/admin/acme/roles')
    await page.getByRole('button', { name: 'Create' }).first().click()
    const name = `shield-e2e-${Date.now()}`
    await admin.fillField('Name', name)
    await page.getByRole('button', { name: 'Create Role', exact: true }).click()
    await admin.expectToast('Created')
    await page.goto('/admin/acme/roles')
    const row = admin.row(name)
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Edit' }).click()
    await admin.fillField('Name', `${name}-edited`)
    await page.getByRole('button', { name: /^Save/ }).last().click()
    await admin.expectToast('Saved')
    await page.goto('/admin/acme/roles')
    await expect(admin.row(`${name}-edited`)).toBeVisible()
    await admin.openAction('Delete', admin.row(`${name}-edited`))
    await page
      .getByRole('button', { name: /delete|confirm/i })
      .last()
      .click()
    await expect(admin.row(`${name}-edited`)).toHaveCount(0)
  }
)
