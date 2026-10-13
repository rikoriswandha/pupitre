import { randomUUID } from 'node:crypto'
import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'Orders table repeater saves two rows and displays a server error in the invalid cell',
  async ({ admin, page }) => {
    await admin.login()
    await admin.gotoResource('orders', '/create')
    await admin.fillField('Name', `Table repeater ${randomUUID().slice(0, 8)}`)
    await admin.fillField('Email', 'table-repeater@example.net')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    const table = page.locator('[data-repeater="items"] table')
    await expect(table.getByRole('columnheader', { name: 'Product' })).toBeVisible()
    await page.getByRole('button', { name: 'Add line item', exact: true }).click()
    const rows = table.locator('tbody tr')
    await expect(rows).toHaveCount(2)
    await rows.nth(0).getByRole('combobox', { name: 'Product', exact: true }).click()
    await page.getByRole('option', { name: 'Fountain Pen', exact: true }).click()
    await rows.nth(0).getByRole('textbox', { name: 'Unit price', exact: true }).fill('62500')
    await rows.nth(1).getByRole('textbox', { name: 'Unit price', exact: true }).fill('25000')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByRole('button', { name: 'Save order', exact: true }).click()
    await expect(
      rows
        .nth(1)
        .locator('td')
        .first()
        .getByText(/product.*(required|defined)/i)
    ).toBeVisible()
    await expect(rows.nth(0).getByText(/product.*(required|defined)/i)).toHaveCount(0)
    await rows.nth(1).getByRole('combobox', { name: 'Product', exact: true }).click()
    await page.getByRole('option', { name: 'Fountain Pen', exact: true }).click()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByRole('button', { name: 'Save order', exact: true }).click()
    await expect(page).toHaveURL(/\/orders\/\d+$/)
    const recordPath = new URL(page.url()).pathname
    await page.goto(`${recordPath}/edit`)
    await page.locator('form').getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.locator('[data-repeater="items"] table tbody tr')).toHaveCount(2)
    await admin.openAction('Delete')
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page).toHaveURL(/\/orders(?:\?.*)?$/)
  }
)
