import { randomUUID } from 'node:crypto'
import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'store overview renders every widget kind and filters by channel',
  async ({ admin, page }) => {
    await admin.login()
    await admin.gotoResource('store')
    for (const heading of [
      'Last 7 days',
      'Daily revenue',
      'Orders per week by channel',
      'Orders by status',
      'Revenue by payment method',
      'Restock queue',
      'Recent order activity',
      'Where to look next',
    ])
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await page.getByRole('combobox', { name: 'Sales channel', exact: true }).click()
    await page.getByRole('option', { name: 'Retail', exact: true }).click()
    await expect(page).toHaveURL(/filters%5Bchannel%5D=retail|filters\[channel\]=retail/)
    await expect(page.getByRole('heading', { name: 'Last 7 days', exact: true })).toBeVisible()
  }
)

pupitreTest(
  'product create fills the slug on the server and previews margin on the client',
  async ({ admin, page }) => {
    const suffix = randomUUID().slice(0, 8)
    const name = `Showcase Lamp ${suffix}`
    let editPath: string | undefined
    try {
      await admin.login()
      await admin.gotoResource('products', '/create')
      await admin.fillField('Name', name)
      await page.getByLabel('SKU').focus()
      await expect(page.getByLabel('Slug')).toHaveValue(`showcase-lamp-${suffix}`)

      await admin.fillField('SKU', 'not valid')
      await admin.fillField('Price', '80000')
      await admin.fillField('Unit cost', '60000')
      const preview = page.getByRole('region', { name: 'Margin preview' })
      await expect(preview.getByText('25% margin')).toBeVisible()

      await page.getByRole('button', { name: 'Create Product', exact: true }).click()
      await expect(page.getByText('The sku field format is invalid')).toBeVisible()
      await admin.fillField('SKU', 'SC-001')
      await page.getByRole('button', { name: 'Create Product', exact: true }).click()
      await expect(page).toHaveURL(/\/products\/\d+\/edit$/)
      editPath = new URL(page.url()).pathname
      await expect(page.getByRole('heading', { name: 'Inventory snapshot' })).toBeVisible()
    } finally {
      if (editPath) {
        await page.goto(editPath)
        await admin.openAction('Delete')
        await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
        await expect(page).toHaveURL(/\/products(?:\?.*)?$/)
      }
    }
  }
)

pupitreTest(
  'order wizard snapshots line items and status actions append to its history',
  async ({ admin, page }) => {
    const customer = `Showcase Buyer ${randomUUID().slice(0, 8)}`
    let viewPath: string | undefined
    try {
      await admin.login()
      await admin.gotoResource('orders', '/create')
      await admin.fillField('Name', customer)
      await admin.fillField('Email', 'buyer@example.net')
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await admin.selectOption('Product', 'Fountain Pen')
      await admin.fillField('Qty', '2')
      await admin.fillField('Unit price', '62500')
      await expect(page.locator('form')).toContainText('125000')
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await admin.selectOption('Status', 'Paid')
      await page.getByRole('button', { name: 'Save order', exact: true }).click()
      await expect(page).toHaveURL(/\/orders\/\d+$/)
      viewPath = new URL(page.url()).pathname
      await expect(page.getByText('IDR 125,000').first()).toBeVisible()
      await expect(page.getByText('Fountain Pen', { exact: true }).first()).toBeVisible()

      await admin.gotoResource('orders', '?tab=open')
      const row = admin.row(customer)
      await admin.openAction('Mark shipped', row)
      await page.getByRole('dialog').getByRole('button', { name: 'Mark shipped' }).click()
      await admin.expectToast('shipped')

      // Shipped orders leave the "To fulfil" tab; refund from the unfiltered list.
      await admin.gotoResource('orders')
      await admin.openAction('Refund', admin.row(customer))
      await expect(page.getByLabel('Details')).toHaveCount(0)
      await admin.selectOption('Reason', 'Other')
      await admin.fillField('Details', 'Changed their mind')
      await admin.submitModal('Issue refund')
      await admin.expectToast('refunded')

      await page.goto(viewPath)
      const history = page.getByRole('region', { name: 'Order history' })
      await expect(history.getByText('Order placed', { exact: true })).toBeVisible()
      await expect(history.getByText('Marked shipped', { exact: true })).toBeVisible()
      await expect(history.getByText('Refunded Rp 125.000', { exact: true })).toBeVisible()
    } finally {
      if (viewPath) {
        await page.goto(`${viewPath}/edit`)
        await admin.openAction('Delete')
        await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
        await expect(page).toHaveURL(/\/orders(?:\?.*)?$/)
      }
    }
  }
)

pupitreTest(
  'form playground enforces cross-field rules and hides dependent fields',
  async ({ admin, page }) => {
    await admin.login()
    await admin.gotoResource('playground')
    await admin.selectOption('Country', 'Indonesia')
    await expect(page.getByLabel('Province')).toBeVisible()
    await admin.selectOption('Country', 'Netherlands')
    await expect(page.getByLabel('Province')).toHaveCount(0)

    await admin.fillField('Handle', 'Showcase1')
    await admin.fillField('Email', 'playground@example.net')
    await admin.fillField('New password', 'long-enough')
    await admin.fillField('Confirm password', 'mismatch')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(
      page.getByText('The passwordConfirmation field and password field must be the same')
    ).toBeVisible()
    await admin.fillField('Confirm password', 'long-enough')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await admin.expectToast('Saved')
    await page.reload()
    await expect(page.getByLabel('Handle')).toHaveValue('showcase1')
    await expect(page.getByLabel('New password')).toHaveValue('')
  }
)

pupitreTest('showcase tour is a host page inside the panel shell', async ({ admin, page }) => {
  await admin.login()
  await admin.gotoResource('tour')
  await expect(page.getByRole('heading', { name: 'Showcase tour', level: 1 })).toBeVisible()
  await page
    .getByRole('region', { name: 'Resources' })
    .getByRole('link', { name: 'Orders' })
    .click()
  await expect(page).toHaveURL(/\/admin\/acme\/orders$/)
})
