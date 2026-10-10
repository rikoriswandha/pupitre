import { DateTime } from 'luxon'

/**
 * Server-side value formatting shared by table cells, infolist entries and
 * form state. Values are formatted in the panel/user/component timezone
 * (ADR-0009): component > user > panel > app default.
 */
export type FormatContext = {
  timezone: string
  locale: string
}

export type DateInput = DateTime | Date | string | number | null | undefined

/**
 * Normalizes a date-ish input to a Luxon `DateTime` in UTC. Strings without an
 * offset are treated as UTC (that is how SQLite returns timestamps).
 */
export function toDateTime(value: DateInput): DateTime | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  let parsed: DateTime
  if (DateTime.isDateTime(value)) {
    parsed = value
  } else if (value instanceof Date) {
    parsed = DateTime.fromJSDate(value)
  } else if (typeof value === 'number') {
    parsed = DateTime.fromMillis(value)
  } else {
    parsed = DateTime.fromISO(value, { setZone: true, zone: 'utc' })
    if (!parsed.isValid) {
      parsed = DateTime.fromSQL(value, { zone: 'utc' })
    }
  }
  return parsed.isValid ? parsed.toUTC() : null
}

/**
 * Resolves the effective timezone by priority: component > user > panel > app.
 */
export function resolveTimezone(...candidates: (string | null | undefined)[]): string {
  for (const candidate of candidates) {
    if (candidate && DateTime.local().setZone(candidate).isValid) {
      return candidate
    }
  }
  return 'UTC'
}

/**
 * ISO 8601 string with offset in the given timezone. This is what form state
 * receives for date/time fields.
 */
export function toIsoInZone(value: DateInput, timezone: string): string | null {
  const dt = toDateTime(value)
  return dt ? dt.setZone(timezone).toISO({ suppressMilliseconds: true }) : null
}

/**
 * Parses a client value (ISO with offset, or a local wall-clock string without
 * offset interpreted in `timezone`) to UTC.
 */
export function parseInZone(value: string | null | undefined, timezone: string): DateTime | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const hasOffset = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value)
  const parsed = hasOffset
    ? DateTime.fromISO(value, { setZone: true })
    : DateTime.fromISO(value, { zone: timezone })
  return parsed.isValid ? parsed.toUTC() : null
}

export function formatDate(value: DateInput, context: FormatContext, format?: string) {
  const dt = toDateTime(value)
  if (!dt) {
    return null
  }
  const zoned = dt.setZone(context.timezone).setLocale(context.locale)
  return format ? zoned.toFormat(format) : zoned.toLocaleString(DateTime.DATE_MED)
}

export function formatDateTime(value: DateInput, context: FormatContext, format?: string) {
  const dt = toDateTime(value)
  if (!dt) {
    return null
  }
  const zoned = dt.setZone(context.timezone).setLocale(context.locale)
  return format ? zoned.toFormat(format) : zoned.toLocaleString(DateTime.DATETIME_MED)
}

export function formatTime(value: DateInput, context: FormatContext, format?: string) {
  const dt = toDateTime(value)
  if (!dt) {
    return null
  }
  const zoned = dt.setZone(context.timezone).setLocale(context.locale)
  return format ? zoned.toFormat(format) : zoned.toLocaleString(DateTime.TIME_SIMPLE)
}

/**
 * Relative time ("3 hours ago") against `now` (defaults to Luxon's clock so
 * tests can lock `Settings.now`).
 */
export function formatSince(value: DateInput, context: FormatContext, now?: DateTime) {
  const dt = toDateTime(value)
  if (!dt) {
    return null
  }
  return dt.setLocale(context.locale).toRelative({ base: now ?? DateTime.now() })
}

export function formatNumber(
  value: number | string | null | undefined,
  context: Pick<FormatContext, 'locale'>,
  options: { decimals?: number } = {}
) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const number = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(number)) {
    return null
  }
  return new Intl.NumberFormat(context.locale, {
    minimumFractionDigits: options.decimals,
    maximumFractionDigits: options.decimals ?? 3,
  }).format(number)
}

export function formatMoney(
  value: number | string | null | undefined,
  context: Pick<FormatContext, 'locale'>,
  options: { currency: string; divideBy?: number }
) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const number = (typeof value === 'string' ? Number(value) : value) / (options.divideBy ?? 1)
  if (Number.isNaN(number)) {
    return null
  }
  return new Intl.NumberFormat(context.locale, {
    style: 'currency',
    currency: options.currency,
  }).format(number)
}

/**
 * Truncates to `limit` characters, appending an ellipsis.
 */
export function truncate(value: unknown, limit: number) {
  if (value === null || value === undefined) {
    return null
  }
  const text = String(value)
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text
}
