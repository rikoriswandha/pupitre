import type { ComputedFunction } from '@json-render/core'
import type { ComputedFunctionName } from '@rikology/pupitre/catalog'

/** Built-in $computed signatures: concat({ values }), add/sub/mul/div({ a, b }), sum({ values }), count({ value }), formatNumber({ value, locale?, decimals?, currency? }), formatDate({ value, format?, timezone? }), pluck({ values, key }), join({ values, separator? }), upper/lower({ value }), truncate({ value, length, suffix? }), coalesce({ values }). */
export const builtInFunctions: Record<ComputedFunctionName, ComputedFunction> = {
  concat: ({ values }) => (Array.isArray(values) ? values.join('') : String(values ?? '')),
  add: ({ a, b }) => Number(a) + Number(b),
  sub: ({ a, b }) => Number(a) - Number(b),
  mul: ({ a, b }) => Number(a) * Number(b),
  div: ({ a, b }) => Number(a) / Number(b),
  sum: ({ values }) =>
    Array.isArray(values) ? values.reduce<number>((total, value) => total + Number(value), 0) : 0,
  count: ({ value }) => {
    if (Array.isArray(value) || typeof value === 'string') return value.length
    if (value === null || value === undefined) return 0
    if (typeof value === 'object') return Object.keys(value).length
    return 1
  },
  formatNumber: ({ value, locale, decimals, currency }) =>
    new Intl.NumberFormat(typeof locale === 'string' ? locale : undefined, {
      minimumFractionDigits: typeof decimals === 'number' ? decimals : undefined,
      maximumFractionDigits: typeof decimals === 'number' ? decimals : undefined,
      style: typeof currency === 'string' ? 'currency' : 'decimal',
      currency: typeof currency === 'string' ? currency : undefined,
    }).format(Number(value)),
  formatDate: ({ value, format, timezone }) => {
    if (value === null || value === undefined || value === '') return ''
    const date = new Date(String(value))
    if (Number.isNaN(date.getTime())) return String(value)
    return new Intl.DateTimeFormat(undefined, {
      timeZone: typeof timezone === 'string' ? timezone : undefined,
      dateStyle: format === 'short' ? 'short' : 'medium',
    }).format(date)
  },
  pluck: ({ values, key }) =>
    Array.isArray(values)
      ? values.map((value) =>
          value && typeof value === 'object'
            ? (value as Record<string, unknown>)[String(key)]
            : undefined
        )
      : [],
  join: ({ values, separator }) =>
    Array.isArray(values) ? values.join(typeof separator === 'string' ? separator : ', ') : '',
  upper: ({ value }) => String(value ?? '').toUpperCase(),
  lower: ({ value }) => String(value ?? '').toLowerCase(),
  truncate: ({ value, length, suffix }) => {
    const text = String(value ?? '')
    const max = typeof length === 'number' ? Math.max(0, length) : text.length
    return text.length > max
      ? `${text.slice(0, max)}${typeof suffix === 'string' ? suffix : '…'}`
      : text
  },
  coalesce: ({ values }) =>
    Array.isArray(values)
      ? values.find((value) => value !== null && value !== undefined && value !== '')
      : values,
}
