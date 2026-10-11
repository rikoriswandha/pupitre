import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'fake Ally provider completes social login without external credentials',
  async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.getByRole('link', { name: 'Continue with fake' })).toBeVisible()
    await page.getByRole('link', { name: 'Continue with fake' }).click()
    await expect(page).toHaveURL(/\/admin(?:\/|$)/)
    await expect(page.getByRole('button', { name: /user/i })).toBeVisible()
    await page.screenshot({ path: 'tmp/social-login.png', fullPage: true })
  }
)
