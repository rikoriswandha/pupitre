import { test as base, expect } from '@playwright/test'
import { AdminPage } from '../pages/admin_page.js'

type Fixtures = { admin: AdminPage }

export const pupitreTest = base.extend<Fixtures>({
  admin: async ({ page }, use) => {
    await use(new AdminPage(page))
  },
})

export { expect }
