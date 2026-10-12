import { Readable } from 'node:stream'
import { stringify } from 'csv-stringify'

export type CsvColumn = {
  key: string
  header: string
}

/** Stringifies records as a backpressure-aware CSV stream. */
export function createCsvStream(
  records: readonly Record<string, unknown>[],
  columns: readonly CsvColumn[],
  header = true
): Readable {
  const serializer = stringify({
    header,
    columns: columns.map(({ key, header: label }) => ({ key, header: label })),
    cast: {
      string: (value) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value),
    },
  })
  Readable.from(records).pipe(serializer)
  return serializer
}
