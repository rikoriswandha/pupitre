import { test } from '@japa/runner'
import { execFileSync } from 'node:child_process'
import { createXlsxStream } from '../../../src/table/xlsx_stream.js'
import { readXlsx } from '../../helpers/xlsx.js'
import { actions } from '../../../src/builder/action.js'

async function workbook(
  rows: Iterable<Record<string, unknown>> | AsyncIterable<Record<string, unknown>>,
  keys: string[],
  name?: string
) {
  const chunks: Buffer[] = []
  for await (const chunk of createXlsxStream(
    rows,
    keys.map((key) => ({ key, header: key })),
    name
  ))
    chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

function validateXml(entries: Record<string, string>) {
  execFileSync(
    'python3',
    [
      '-c',
      'import json,sys; from xml.dom import minidom; [minidom.parseString(v) for v in json.load(sys.stdin).values()]',
    ],
    { input: JSON.stringify(entries) }
  )
}

test.group('Streaming XLSX', () => {
  test('exports escaped typed cells, Unicode, XML-safe text and formula-safe strings', async ({
    assert,
  }) => {
    const entries = readXlsx(
      await workbook(
        [
          {
            text: '&<>"\'\u0000\u0001\ud800 café 😀',
            number: -12.5,
            boolean: true,
            empty: null,
            formula: '=SUM(A1)',
            tab: '\tx',
            false: false,
          },
        ],
        ['text', 'number', 'boolean', 'empty', 'formula', 'tab', 'false'],
        '[]:*?/\\' + 'A'.repeat(40)
      )
    )
    validateXml(entries)
    assert.lengthOf(Object.keys(entries), 6)
    const sheet = entries['xl/worksheets/sheet1.xml']!
    assert.include(sheet, '&amp;&lt;&gt;&quot;&apos; café 😀')
    assert.include(sheet, '<c r="B2"><v>-12.5</v></c>')
    assert.include(sheet, '<c r="C2" t="b"><v>1</v></c>')
    assert.include(sheet, '<c r="D2"/>')
    assert.include(sheet, '&apos;=SUM(A1)')
    assert.include(sheet, '&apos;\tx')
    assert.include(sheet, '<c r="G2" t="b"><v>0</v></c>')
    assert.notInclude(sheet, '<f>')
    assert.include(entries['xl/workbook.xml']!, `name="${'A'.repeat(31)}"`)
    assert.include(entries['xl/styles.xml']!, '<b/>')
  })
  test('produces a valid empty workbook with a bold header', async ({ assert }) => {
    const entries = readXlsx(await workbook([], ['Title']))
    validateXml(entries)
    assert.include(entries['xl/worksheets/sheet1.xml']!, 'r="A1" s="1"')
    assert.equal(entries['xl/worksheets/sheet1.xml']!.match(/<row /g)?.length, 1)
  })
  test('streams many async rows and columns beyond Z without losing values', async ({ assert }) => {
    async function* rows() {
      for (let index = 0; index < 10000; index++) yield { value: index }
    }
    const entries = readXlsx(
      await workbook(
        rows(),
        Array.from({ length: 27 }, () => 'value')
      )
    )
    validateXml(entries)
    const sheet = entries['xl/worksheets/sheet1.xml']!
    assert.equal(sheet.match(/<row /g)?.length, 10001)
    assert.include(sheet, '<c r="AA10001"><v>9999</v></c>')
  })
  test('preserves immutable format choices and rejects invalid configuration', ({ assert }) => {
    const csv = actions.export()
    const multiple = csv.formats(['csv', 'xlsx'])
    assert.isUndefined(csv.definition.exportFormats)
    assert.deepEqual(multiple.definition.exportFormats, ['csv', 'xlsx'])
    assert.throws(() => csv.formats([]))
    assert.throws(() => actions.create().formats(['xlsx']))
  })
  test('propagates row-source failures', async ({ assert }) => {
    async function* broken() {
      yield { value: 1 }
      throw new Error('source failed')
    }
    await assert.rejects(() => workbook(broken(), ['value']), 'source failed')
  })
})
