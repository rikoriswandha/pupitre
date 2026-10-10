import { test } from '@japa/runner'
import { DateTime, Settings } from 'luxon'
import {
  formatDateTime,
  formatMoney,
  formatSince,
  parseInZone,
  resolveTimezone,
  toIsoInZone,
} from '../../../src/format/index.js'

test.group('format | dates', (group) => {
  const originalNow = Settings.now
  group.each.teardown(() => {
    Settings.now = originalNow
  })

  test('formats a UTC timestamp in the panel timezone', ({ assert }) => {
    const value = DateTime.fromISO('2026-01-15T17:30:00Z')
    assert.equal(
      formatDateTime(value, { timezone: 'Asia/Jakarta', locale: 'en' }, 'yyyy-MM-dd HH:mm'),
      '2026-01-16 00:30'
    )
  })

  test('SQLite strings without offset are read as UTC', ({ assert }) => {
    assert.equal(
      formatDateTime('2026-01-15 17:30:00', { timezone: 'Asia/Jakarta', locale: 'en' }, 'HH:mm'),
      '00:30'
    )
  })

  test('respects DST transitions (Europe/Amsterdam)', ({ assert }) => {
    const context = { timezone: 'Europe/Amsterdam', locale: 'en' }
    assert.equal(formatDateTime('2026-03-29T00:30:00Z', context, 'HH:mm ZZ'), '01:30 +01:00')
    assert.equal(formatDateTime('2026-03-29T01:30:00Z', context, 'HH:mm ZZ'), '03:30 +02:00')
  })

  test('form state is ISO with the zone offset and parses back to UTC', ({ assert }) => {
    const iso = toIsoInZone('2026-06-01T03:00:00Z', 'Asia/Jakarta')
    assert.equal(iso, '2026-06-01T10:00:00+07:00')
    assert.equal(parseInZone(iso, 'UTC')!.toISO(), '2026-06-01T03:00:00.000Z')
  })

  test('wall-clock input without offset is interpreted in the timezone', ({ assert }) => {
    assert.equal(
      parseInZone('2026-06-01T10:00', 'Asia/Jakarta')!.toISO(),
      '2026-06-01T03:00:00.000Z'
    )
    assert.isNull(parseInZone('', 'Asia/Jakarta'))
    assert.isNull(parseInZone('not a date', 'Asia/Jakarta'))
  })

  test('relative time uses the locked clock', ({ assert }) => {
    const locked = DateTime.fromISO('2026-01-15T20:30:00Z').toMillis()
    Settings.now = () => locked
    assert.equal(
      formatSince('2026-01-15T17:30:00Z', { timezone: 'UTC', locale: 'en' }),
      '3 hours ago'
    )
  })

  test('timezone priority skips missing and invalid zones', ({ assert }) => {
    assert.equal(resolveTimezone(undefined, 'Not/AZone', 'Asia/Jakarta', 'UTC'), 'Asia/Jakarta')
    assert.equal(resolveTimezone(null, undefined), 'UTC')
  })
})

test.group('format | numbers', () => {
  test('money uses the locale and currency', ({ assert }) => {
    assert.equal(formatMoney(1234.5, { locale: 'en-US' }, { currency: 'USD' }), '$1,234.50')
    assert.equal(
      formatMoney(150000, { locale: 'en-US' }, { currency: 'USD', divideBy: 100 }),
      '$1,500.00'
    )
    assert.isNull(formatMoney(null, { locale: 'en-US' }, { currency: 'USD' }))
  })
})
