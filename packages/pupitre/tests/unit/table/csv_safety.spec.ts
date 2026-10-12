import { test } from '@japa/runner'
import { parse } from 'csv-parse/sync'
import { createCsvStream } from '../../../src/table/csv_stream.js'

test.group('CSV spreadsheet safety', () => {
  test('escapes dangerous strings and headers without changing numeric cells', async ({
    assert,
  }) => {
    const values = [
      '=HYPERLINK("https://example.test")',
      '+SUM(A1)',
      '-5',
      '@cmd',
      '\tcmd',
      '\rcmd',
      'safe',
      -5,
    ]
    const columns = values.map((_value, index) => ({
      key: String(index),
      header: `=column${index}`,
    }))
    const stream = createCsvStream(
      [Object.fromEntries(values.map((value, index) => [String(index), value]))],
      columns
    )
    let csv = ''
    for await (const chunk of stream) csv += String(chunk)
    const rows = parse(csv) as string[][]
    assert.deepEqual(
      rows[0],
      columns.map((column) => `'${column.header}`)
    )
    assert.deepEqual(
      rows[1],
      values.map((value) =>
        typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value)
      )
    )
    assert.equal(rows[1]?.at(-1), '-5')
  })
})
