import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'switches language, keeps record data intact and persists through reload',
  async ({ admin, page }) => {
    await admin.login()
    await admin.gotoResource('posts/1')
    const title = await page.getByRole('heading', { level: 1 }).textContent()
    expect(title).toBeTruthy()
    await expect(page.getByText('2026 Oct 07, 19:00')).toBeVisible()

    await page.getByRole('button', { name: 'Open user menu', exact: true }).click()
    await page.getByRole('menuitemradio', { name: 'Indonesia', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Buka menu pengguna', exact: true })
    ).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title!)
    await expect(page.getByText('2026 Okt 07, 19:00')).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'Buka menu pengguna', exact: true })
    ).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title!)

    await page.getByRole('button', { name: 'Buka menu pengguna', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Profil', exact: true })).toBeVisible()
    await page.getByRole('menuitemradio', { name: 'English', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open user menu', exact: true })).toBeVisible()
    await expect(page.getByText('2026 Oct 07, 19:00')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title!)
  }
)

pupitreTest(
  'uses Indonesian table controls and server validation after a language change',
  async ({ admin, page }) => {
    await admin.login()
    await page.getByRole('button', { name: 'Open user menu', exact: true }).click()
    await page.getByRole('menuitemradio', { name: 'Indonesia', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Buka menu pengguna', exact: true })
    ).toBeVisible()
    await admin.gotoResource('posts')
    await expect(page.getByLabel('Cari', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Baris per halaman', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Berikutnya', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sebelumnya', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Buat', exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Buat', exact: true }).first().click()
    await page.locator('form').evaluate('(form) => { form.noValidate = true }')
    // Host-authored unmarked labels remain in their source language.
    await page.getByRole('button', { name: 'Save post', exact: true }).click()
    await expect(page.getByText(/wajib diisi/i).first()).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/acme\/posts\/create/)
  }
)
