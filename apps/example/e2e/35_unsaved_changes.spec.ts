import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'dirty edit form asks before leaving via the shared confirm dialog',
  async ({ admin, page }) => {
    await admin.login()
    await page.goto('/admin/acme/posts/2/edit')
    const title = page.getByLabel('Title')
    const original = await title.inputValue()
    const confirm = page.getByRole('dialog', { name: 'Discard unsaved changes?' })
    let nativeDialogs = 0
    page.on('dialog', (dialog) => {
      nativeDialogs += 1
      void dialog.dismiss()
    })

    await admin.fillField('Title', `${original} (unsaved)`)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Stay', exact: true }).click()
    await expect(confirm).toBeHidden()
    await expect(page).toHaveURL('/admin/acme/posts/2/edit')
    await expect(title).toHaveValue(`${original} (unsaved)`)

    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await confirm.getByRole('button', { name: 'Leave page', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/acme\/posts(?:\?.*)?$/)
    expect(nativeDialogs).toBe(0)

    await page.goto('/admin/acme/posts/2/edit')
    await expect(page.getByLabel('Title')).toHaveValue(original)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/acme\/posts(?:\?.*)?$/)
    await expect(confirm).toHaveCount(0)
  }
)
