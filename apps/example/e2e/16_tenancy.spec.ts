import { pupitreTest, expect } from './fixtures/pupitre_test.js'

pupitreTest(
  'switches tenant lists and denies cross-tenant records and non-members',
  async ({ admin, page }) => {
    await admin.login()
    await expect(admin.postRow('Field Notes 01')).toBeVisible()
    await page.getByRole('button', { name: 'Switch tenant' }).click()
    await page.getByRole('menuitem', { name: 'Globex' }).click()
    // Switching lands on the tenant home, which redirects to its first listable resource.
    await expect(page).toHaveURL(/\/admin\/globex\/[a-z-]+(?:\?.*)?$/)
    await page.getByRole('link', { name: /^Posts/ }).click()
    await expect(page).toHaveURL(/\/admin\/globex\/posts(?:\?.*)?$/)
    await expect(admin.postRow('Globex Field Notes 01')).toBeVisible()
    // Acme's "Field Notes 01" must not leak into Globex's list.
    await expect(
      page.getByRole('row').filter({ hasText: /(?<!Globex )Field Notes 01/ })
    ).toHaveCount(0)

    // Post 31 belongs to Globex: requesting it under Acme must 404, not leak it.
    const foreignRecord = await page.goto('/admin/acme/posts/31')
    expect(foreignRecord?.status()).toBe(404)
    await expect(page.getByText('Globex Field Notes 01')).toHaveCount(0)

    await page.context().clearCookies()
    await admin.login('editor@example.com')
    const forbiddenTenant = await page.request.get('/admin/globex/posts')
    expect(forbiddenTenant.status()).toBe(404)
  }
)
