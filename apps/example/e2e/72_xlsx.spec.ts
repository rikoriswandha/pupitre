import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'
import { readFile } from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'

pupitreTest(
  'Products exports Excel through the labelled format picker',
  async ({ admin, page }) => {
    await admin.login()
    await admin.gotoResource('products')
    await page.getByRole('button', { name: 'Export', exact: true }).first().click()
    const dialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('radio', { name: 'Excel (XLSX)' }) })
    await expect(dialog.getByRole('group', { name: 'Export format' })).toBeVisible()
    await dialog.getByRole('radio', { name: 'Excel (XLSX)' }).check()
    const pending = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Export', exact: true }).click()
    const download = await pending
    expect(download.suggestedFilename()).toMatch(/products-.*\.xlsx$/)
    const bytes = await readFile((await download.path())!)
    expect(bytes.readUInt32LE(0)).toBe(0x04034b50)
    let offset = bytes.readUInt32LE(bytes.length - 6)
    let sheet = ''
    for (let index = 0; index < bytes.readUInt16LE(bytes.length - 12); index++) {
      expect(bytes.readUInt32LE(offset)).toBe(0x02014b50)
      const nameLength = bytes.readUInt16LE(offset + 28)
      const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString()
      if (name === 'xl/worksheets/sheet1.xml') {
        const local = bytes.readUInt32LE(offset + 42)
        const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
        sheet = inflateRawSync(
          bytes.subarray(start, start + bytes.readUInt32LE(offset + 20))
        ).toString()
      }
      offset += 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32)
    }
    expect(sheet).toContain('<worksheet')
    expect(sheet).toContain('SKU')
    expect(sheet).toContain('Name')
    expect(sheet).toContain('<row r="2">')
    expect(sheet).not.toContain('<f>')
  }
)
