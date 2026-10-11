import { test } from '@japa/runner'
import { DateTime, Settings } from 'luxon'
import { compileValidator } from '../../../src/compiler/vine_compiler.js'
import { schema } from '../../../src/builder/schema/schema.js'
import { formatDate, formatDateTime, parseInZone, toIsoInZone } from '../../../src/format/index.js'
import { table as tableBuilder } from '../../../src/builder/table/table.js'
import { applyTableQuery } from '../../../src/query/table_query.js'

test.group('timezone formatting and parsing', () => {
  test('parses local wall times in the effective zone and preserves explicit offsets', ({
    assert,
  }) => {
    const previousZone = Settings.defaultZone
    const previousNow = Settings.now
    Settings.defaultZone = 'UTC'
    Settings.now = () => Date.UTC(2026, 0, 1)
    try {
      assert.equal(
        parseInZone('2026-10-07T19:00', 'Asia/Jakarta')?.toISO(),
        '2026-10-07T12:00:00.000Z'
      )
      assert.equal(
        parseInZone('2026-10-07T19:00+02:00', 'Asia/Jakarta')?.toISO(),
        '2026-10-07T17:00:00.000Z'
      )
      const instant = DateTime.fromISO('2026-10-07T12:00:00Z')
      assert.equal(toIsoInZone(instant, 'Asia/Jakarta'), '2026-10-07T19:00:00+07:00')
      assert.equal(
        formatDateTime(instant, { locale: 'en', timezone: 'Europe/Amsterdam' }),
        'Oct 7, 2026, 2:00 PM'
      )
      assert.equal(
        formatDate('2026-03-29', { locale: 'en', timezone: 'America/Los_Angeles' }),
        'Mar 29, 2026'
      )
    } finally {
      Settings.defaultZone = previousZone
      Settings.now = previousNow
    }
  })

  test('rejects nonexistent Amsterdam spring-forward times and chooses the earlier overlap offset', ({
    assert,
  }) => {
    const previousZone = Settings.defaultZone
    const previousNow = Settings.now
    Settings.defaultZone = 'Asia/Jakarta'
    Settings.now = () => Date.UTC(2026, 2, 29)
    try {
      assert.isNull(parseInZone('2026-03-29T02:30', 'Europe/Amsterdam'))
      assert.equal(
        parseInZone('2026-10-25T02:30', 'Europe/Amsterdam')?.toISO(),
        '2026-10-25T00:30:00.000Z'
      )
      assert.equal(
        parseInZone('2026-03-29T02:30', 'Asia/Jakarta')?.toISO(),
        '2026-03-28T19:30:00.000Z'
      )
    } finally {
      Settings.defaultZone = previousZone
      Settings.now = previousNow
    }
  })

  test('validates and stores datetime fields in the field timezone', async ({ assert }) => {
    const previousZone = Settings.defaultZone
    const previousNow = Settings.now
    Settings.defaultZone = 'UTC'
    Settings.now = () => Date.UTC(2026, 2, 29)
    try {
      const field = schema.dateTime('publishedAt').timezone('Europe/Amsterdam').toDefinition()
      assert.equal(field.timezone, 'Europe/Amsterdam')
      const validator = compileValidator([field])
      await assert.rejects(() =>
        validator.validate({ publishedAt: '2026-03-29T02:30' }, { timezone: 'Asia/Jakarta' })
      )
      const result = await validator.validate(
        { publishedAt: '2026-10-25T02:30' },
        { timezone: 'Asia/Jakarta' }
      )
      assert.equal((result.publishedAt as DateTime).toUTC().toISO(), '2026-10-25T00:30:00.000Z')
    } finally {
      Settings.defaultZone = previousZone
      Settings.now = previousNow
    }
  })
  test('accepts component timezone overrides on table columns and filters', ({ assert }) => {
    const column = tableBuilder.text('publishedAt').dateTime().timezone('Europe/Amsterdam')
    const filter = tableBuilder.filter.dateRange('publishedAt').timezone('Asia/Jakarta')
    assert.equal(column.toDefinition().timezone, 'Europe/Amsterdam')
    assert.equal(filter.toDefinition().timezone, 'Asia/Jakarta')
    const entry = schema
      .textEntry('publishedAt')
      .dateTime('yyyy LLL dd, HH:mm')
      .timezone('Europe/Amsterdam')
    assert.equal(entry.toDefinition().timezone, 'Europe/Amsterdam')
  })
  test('interprets date-range boundaries using the filter timezone before the user timezone', ({
    assert,
  }) => {
    const filter = tableBuilder.filter
      .dateRange('publishedAt')
      .timezone('Europe/Amsterdam')
      .toDefinition()
    const ranges: [string, string][] = []
    const query = {
      whereBetween: (_column: string, values: [string, string]) => ranges.push(values),
    }
    applyTableQuery(
      query as never,
      { columns: [], filters: [filter], paginated: false } as never,
      { filters: { publishedAt: { from: '2026-10-07', to: '2026-10-07' } } },
      { ctx: { pupitre: { timezone: 'Asia/Jakarta' } } as never }
    )
    assert.isTrue(ranges[0]![0].startsWith('2026-10-06 22:00:00'))
    assert.isTrue(ranges[0]![1].startsWith('2026-10-07 21:59:59.999'))
  })
})
