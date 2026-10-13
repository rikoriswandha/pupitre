import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'ordinary host report job appears in the tenant job monitor',
  async ({ admin, page }) => {
    await admin.login()
    await page.goto('/admin/acme/jobs')
    await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible()
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/actions/run-demo') && response.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Run report job', exact: true }).click(),
    ])
    await page.reload()
    const run = page.getByRole('row').filter({ hasText: 'MonitorDemoJob' }).first()
    await expect(run).toBeVisible()
    await expect(run).toContainText('Completed')
    await expect(page.getByText('Jobs in the last 24 hours', { exact: true })).toBeVisible()
    const detailUrl = await run
      .getByRole('link', { name: 'MonitorDemoJob', exact: true })
      .getAttribute('href')
    await page.goto(detailUrl!)
    await expect(page).toHaveURL(/\/jobs\/[^/]+$/)
    await expect(page.getByText('Post status report', { exact: false })).toBeVisible()
    await expect(page.getByText('Payload', { exact: true })).toBeVisible()
    await page.goto('/admin/globex/jobs')
    await expect(page.getByRole('row').filter({ hasText: 'MonitorDemoJob' })).toHaveCount(0)
  }
)
