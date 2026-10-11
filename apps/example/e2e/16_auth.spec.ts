import { mkdir, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest('invalid credentials return an email field error', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill('editor@example.com')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('These credentials do not match our records')).toBeVisible()
})

pupitreTest(
  'forgot password can reset a seeded user and sign in with the new password',
  async ({ page }) => {
    const mailDirectory = join(import.meta.dirname, '../tmp/mails')
    await mkdir(mailDirectory, { recursive: true })
    const previousMailFiles = new Set(await readdir(mailDirectory))

    await page.goto('/admin/password/forgot')
    await page.getByLabel('Email').fill('reset@example.com')
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect
      .poll(async () => {
        const files = await readdir(mailDirectory)
        return files.filter((file) => !previousMailFiles.has(file)).length
      })
      .toBeGreaterThan(0)
    const allMailFiles = await readdir(mailDirectory)
    const mailFiles = allMailFiles.filter((file) => !previousMailFiles.has(file))
    const messages = await Promise.all(
      mailFiles.map(
        async (file) =>
          JSON.parse(await readFile(join(mailDirectory, file), 'utf8')) as {
            to: string
            text: string
          }
      )
    )
    const mail = messages.find(
      (message) => message.to === 'reset@example.com' && message.text.includes('/password/reset/')
    )
    expect(mail).toBeDefined()
    const resetUrl = mail!.text.match(/https?:\/\/\S+/)?.[0]
    expect(resetUrl).toBeDefined()
    await page.goto(resetUrl!)
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('new-password-123')
    await page
      .getByRole('textbox', { name: 'Confirm password', exact: true })
      .fill('new-password-123')
    await page.getByRole('button', { name: 'Reset password' }).click()
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill('reset@example.com')
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('new-password-123')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(/\/admin(?:\/|$)/)
  }
)

pupitreTest('a logged in user can update their profile and log out', async ({ admin, page }) => {
  // The editor's password was changed by the reset test above; use the admin account.
  await admin.login()
  await page.goto('/admin/profile')
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Editorial Admin Updated')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Profile updated')).toBeVisible()
  await page.getByRole('button', { name: /user/i }).click()
  await page.getByRole('menuitem', { name: /log out/i }).click()
  await expect(page).toHaveURL(/\/admin\/login/)
})
