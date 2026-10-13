import { Readable } from 'node:stream'
import { createDeflateRaw, crc32 } from 'node:zlib'
import type { CsvColumn } from './csv_stream.js'

const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const spreadsheetNamespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

/** Remove XML 1.0-illegal code points, including unpaired UTF-16 surrogates. */
function xml(value: string): string {
  return (
    value
      // XML 1.0 explicitly permits tab, newline and carriage return.
      // eslint-disable-next-line no-control-regex
      .replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, '')
      .replace(
        /[&<>"']/g,
        (character) =>
          ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!
      )
  )
}

function columnName(index: number): string {
  let name = ''
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26))
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name
  return name
}

function cell(value: unknown, reference: string, header = false): string {
  const attributes = `r="${reference}"${header ? ' s="1"' : ''}`
  if (value === null || value === undefined) return `<c ${attributes}/>`
  if (typeof value === 'number' && Number.isFinite(value))
    return `<c ${attributes}><v>${value}</v></c>`
  if (typeof value === 'boolean') return `<c ${attributes} t="b"><v>${value ? 1 : 0}</v></c>`
  let text = String(value)
  // Match CSV's formula-injection policy; never emit formula elements.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `<c ${attributes} t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`
}

type Entry = { name: string; contents: Iterable<string> | AsyncIterable<string> }
type DirectoryEntry = {
  name: Buffer
  offset: number
  crc: number
  compressed: number
  size: number
}

/** ZIP32 with raw deflate and data descriptors: worksheet bytes are never accumulated. */
async function* zip(entries: Entry[]): AsyncGenerator<Buffer> {
  const directory: DirectoryEntry[] = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name)
    const start = offset
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0808, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(name.length, 26)
    yield local
    yield name
    offset += local.length + name.length
    let checksum = 0
    let size = 0
    let compressed = 0
    async function* source() {
      for await (const text of entry.contents) {
        const bytes = Buffer.from(text)
        checksum = crc32(bytes, checksum)
        size += bytes.length
        if (size > 0xffffffff) throw new Error('XLSX entry exceeds ZIP32 limits')
        yield bytes
      }
    }
    const input = Readable.from(source())
    const deflater = createDeflateRaw()
    input.on('error', (error) => deflater.destroy(error))
    input.pipe(deflater)
    try {
      for await (const chunk of deflater) {
        const bytes = chunk as Buffer
        compressed += bytes.length
        offset += bytes.length
        yield bytes
      }
    } finally {
      input.destroy()
      deflater.destroy()
    }
    const descriptor = Buffer.alloc(16)
    descriptor.writeUInt32LE(0x08074b50)
    descriptor.writeUInt32LE(checksum, 4)
    descriptor.writeUInt32LE(compressed, 8)
    descriptor.writeUInt32LE(size, 12)
    yield descriptor
    offset += descriptor.length
    directory.push({ name, offset: start, crc: checksum, compressed, size })
  }
  const directoryStart = offset
  for (const entry of directory) {
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0808, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(entry.crc, 16)
    central.writeUInt32LE(entry.compressed, 20)
    central.writeUInt32LE(entry.size, 24)
    central.writeUInt16LE(entry.name.length, 28)
    central.writeUInt32LE(entry.offset, 42)
    yield central
    yield entry.name
    offset += central.length + entry.name.length
  }
  if (offset > 0xffffffff) throw new Error('XLSX archive exceeds ZIP32 limits')
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50)
  end.writeUInt16LE(directory.length, 8)
  end.writeUInt16LE(directory.length, 10)
  end.writeUInt32LE(offset - directoryStart, 12)
  end.writeUInt32LE(directoryStart, 16)
  yield end
}

export const xlsxContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** One worksheet, inline strings and typed primitive cells; accepts backpressure-aware async rows. */
export function createXlsxStream(
  records: Iterable<Record<string, unknown>> | AsyncIterable<Record<string, unknown>>,
  columns: readonly CsvColumn[],
  sheetName = 'Export'
): Readable {
  if (columns.length > 16_384) throw new Error('XLSX supports at most 16384 columns')
  const name =
    xml(
      sheetName
        .replace(/[\[\]:*?\/\\]/g, '')
        .replace(/^'+|'+$/g, '')
        .slice(0, 31)
    ) || 'Export'
  async function* worksheet() {
    yield `${xmlDeclaration}<worksheet xmlns="${spreadsheetNamespace}"><sheetData>`
    yield `<row r="1">${columns.map((column, index) => cell(column.header, `${columnName(index)}1`, true)).join('')}</row>`
    let row = 1
    for await (const record of records) {
      row++
      if (row > 1_048_576)
        throw new Error('XLSX supports at most 1048576 rows including the header')
      yield `<row r="${row}">${columns.map((column, index) => cell(record[column.key], `${columnName(index)}${row}`)).join('')}</row>`
    }
    yield '</sheetData></worksheet>'
  }
  const textEntry = (entryName: string, text: string): Entry => ({
    name: entryName,
    contents: [xmlDeclaration + text],
  })
  return Readable.from(
    zip([
      textEntry(
        '[Content_Types].xml',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'
      ),
      textEntry(
        '_rels/.rels',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
      ),
      textEntry(
        'xl/workbook.xml',
        `<workbook xmlns="${spreadsheetNamespace}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`
      ),
      textEntry(
        'xl/_rels/workbook.xml.rels',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
      ),
      textEntry(
        'xl/styles.xml',
        `<styleSheet xmlns="${spreadsheetNamespace}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
      ),
      { name: 'xl/worksheets/sheet1.xml', contents: worksheet() },
    ])
  )
}
