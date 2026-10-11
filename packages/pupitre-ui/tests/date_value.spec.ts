import { test } from '@japa/runner'
import { fromDateTimeInput, timezoneHint, toInputValue } from '../src/primitives/date_value.js'

test.group('date input values', () => {
  test('shows the wall-clock part of zoned ISO state', ({ assert }) => {
    assert.equal(toInputValue('2026-10-07T19:00:00+07:00', 'datetime'), '2026-10-07T19:00')
    assert.equal(toInputValue('2026-10-07T19:00:30+07:00', 'datetime', true), '2026-10-07T19:00:30')
    assert.equal(toInputValue('2026-10-07T00:00:00+07:00', 'date'), '2026-10-07')
    assert.equal(toInputValue('2026-10-07T19:05:00+07:00', 'time'), '19:05')
    assert.equal(toInputValue(null, 'datetime'), '')
  })

  test('keeps datetime edits as wall-clock strings for server-side timezone parsing', ({
    assert,
  }) => {
    assert.equal(fromDateTimeInput('2026-10-07T19:00', 'Asia/Jakarta'), '2026-10-07T19:00')
    assert.equal(fromDateTimeInput('2026-03-29T02:30', 'Europe/Amsterdam'), '2026-03-29T02:30')
    assert.isNull(fromDateTimeInput('', 'Asia/Jakarta'))
    assert.equal(fromDateTimeInput('2026-10-07T19:00', undefined), '2026-10-07T19:00')
    assert.isNull(timezoneHint(Intl.DateTimeFormat().resolvedOptions().timeZone))
  })
})
