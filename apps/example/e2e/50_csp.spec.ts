import { randomUUID } from 'node:crypto'
import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'all admin surfaces and lazy editors run without unsafe-eval',
  async ({ admin, page }) => {
    const violations: string[] = []
    await page.exposeFunction('recordCspViolation', (value: string) => violations.push(value))
    await page.addInitScript(() => {
      const target = globalThis as typeof globalThis & {
        cspViolations: string[]
        recordCspViolation: (value: string) => Promise<void>
        addEventListener: (
          type: string,
          listener: (event: { effectiveDirective: string; blockedURI: string }) => void
        ) => void
      }
      target.cspViolations = []
      target.addEventListener('securitypolicyviolation', (event) => {
        if (event.effectiveDirective.startsWith('script-src') || event.blockedURI === 'eval') {
          const value = `${event.effectiveDirective}: ${event.blockedURI}`
          target.cspViolations.push(value)
          void target.recordCspViolation(value)
        }
      })
    })
    const visit = async (path: string) => {
      const response = await page.goto(path)
      expect(response).not.toBeNull()
      const policy = response!.headers()['content-security-policy']
      expect(policy).toBeTruthy()
      expect(policy).not.toContain("'unsafe-eval'")
      await expect(page.locator('main')).toBeVisible()
      expect(violations).toEqual([])
    }
    await visit('/admin/login')
    await admin.login()
    await visit('/admin/acme')
    await visit('/admin/acme/posts')
    await visit('/admin/acme/posts/create')
    const title = `CSP ${randomUUID()}`
    let recordPath: string | undefined
    try {
      await admin.fillField('Title', title)
      await admin.fillField('Slug', title.toLowerCase().replaceAll(' ', '-'))
      await admin.fillField('Category', 'Culture')
      await page.getByRole('tab', { name: 'Content', exact: true }).click()
      await expect(page.locator('[contenteditable=true]').first()).toBeVisible()
      await page.getByRole('button', { name: 'Save post', exact: true }).click()
      await expect(page).toHaveURL(/\/posts\/\d+\/edit/)
      recordPath = new URL(page.url()).pathname.replace(/\/edit$/, '')
      await visit(`${recordPath}/edit`)
      await page.getByRole('tab', { name: 'Content', exact: true }).click()
      await expect(page.locator('[contenteditable=true]').first()).toBeVisible()
      await visit(recordPath)
      await visit('/admin/acme/roles')
      await visit('/admin/acme/activity')
      await visit('/admin/acme/settings')
      await expect(page.locator('.cm-content').first()).toBeVisible()
      expect(violations).toEqual([])
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
    expect(violations).toEqual([])
  }
)
