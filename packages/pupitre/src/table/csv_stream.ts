import { Readable } from 'node:stream'
import { stringify } from 'csv-stringify'

export type CsvColumn = {
  key: string
  header: string
}

/** Stringifies records as a backpressure-aware CSV stream. */
export function createCsvStream(
  records: Iterable<Record<string, unknown>> | AsyncIterable<Record<string, unknown>>,
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
  const source = Readable.from(records)
  source.on('error', (error) => serializer.destroy(error))
  serializer.on('close', () => source.destroy())
  source.pipe(serializer)
  return serializer
}
