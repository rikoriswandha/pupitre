/**
 * Conversion between form state and native date inputs (ADR-0009).
 *
 * Form state holds ISO 8601 strings with the offset of the field's timezone
 * (the server compiles `2026-10-07T19:00:00+07:00` for Asia/Jakarta). Native
 * `date`/`datetime-local`/`time` inputs only accept wall-clock values, so the
 * wall-clock part is shown as-is and edits are sent back as ISO with the offset
 * that timezone has at the chosen instant (DST-aware via `Intl`).
 */
export type DateInputKind = 'date' | 'datetime' | 'time'

const ISO_WITH_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?/

export function toInputValue(
  value: string | null | undefined,
  kind: DateInputKind,
  seconds = false
): string {
  if (!value) {
    return ''
  }
  const match = ISO_WITH_TIME.exec(value)
  if (!match) {
    return value
  }
  const [, date, minutes, secondsPart = ':00'] = match
  if (kind === 'date') {
    return date!
  }
  const time = seconds ? `${minutes}${secondsPart}` : minutes!
  return kind === 'time' ? time : `${date}T${time}`
}

/**
 * Offset in minutes between `timeZone` and UTC at `utcMillis`.
 */
function zoneOffsetMinutes(utcMillis: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMillis))
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value)
  const asUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second')
  )
  return Math.round((asUtc - utcMillis) / 60_000)
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const absolute = Math.abs(minutes)
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
  return `${sign}${hours}:${String(absolute % 60).padStart(2, '0')}`
}

/**
 * Turns a native datetime-local value (`2026-10-07T19:00`) into ISO with the
 * timezone's offset at that wall-clock time. Without a timezone the wall-clock
 * value is returned unchanged and the server interprets it in the field zone.
 */
export function fromDateTimeInput(local: string, timeZone: string | undefined): string | null {
  if (!local) {
    return null
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local)
  if (!match || !timeZone) {
    return local
  }
  const [, year, month, day, hour, minute, second = '00'] = match
  const wallClock = Date.UTC(+year!, +month! - 1, +day!, +hour!, +minute!, +second)
  // Two passes settle the offset around DST transitions.
  let utc = wallClock - zoneOffsetMinutes(wallClock, timeZone) * 60_000
  utc = wallClock - zoneOffsetMinutes(utc, timeZone) * 60_000
  const time = local.length > 16 ? local.slice(11) : `${local.slice(11)}:00`
  return `${local.slice(0, 10)}T${time}${formatOffset(zoneOffsetMinutes(utc, timeZone))}`
}
