import { t } from '@rikology/pupitre-react'
/**
 * Conversion between form state and native date inputs (ADR-0009).
 *
 * Form state holds ISO 8601 strings with the offset of the effective field
 * timezone (the server compiles `2026-10-07T19:00:00+07:00` for Asia/Jakarta).
 * Native date/time inputs show only the wall-clock part. Datetime edits remain
 * timezone-free local strings until the server validates and resolves their
 * zone, which allows it to reject nonexistent times during DST transitions.
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
 * Returns a compact hint only when the effective zone differs from the
 * browser's zone. Input values themselves remain wall-clock strings; the
 * server parses them in the effective zone and rejects DST gaps.
 */
export function timezoneHint(timeZone: string | null | undefined): string | null {
  if (!timeZone) return null
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (!browserZone || browserZone === timeZone) return null
  return t('Times shown in {timezone} (browser: {browser})', {
    timezone: timeZone,
    browser: browserZone,
  })
}

/** Native datetime-local values are deliberately submitted without an offset. */
export function fromDateTimeInput(local: string, _timeZone?: string): string | null {
  return local || null
}
