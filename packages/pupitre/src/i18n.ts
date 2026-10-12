import { createHmac, randomBytes } from 'node:crypto'
import id from './locales/id.js'
import type { PupitreConfig } from './define_config.js'
import type { PanelDefinition } from './definition/panel.js'

export type Message = string | { one: string; other: string; zero?: string }
export type MessageDictionary = Record<string, Message>
export type LocaleMessages = Record<string, MessageDictionary>
export type TranslationParams = Record<string, string | number>
export const requestMessages = new WeakMap<object, MessageDictionary>()
// Unicode TAG characters carry authenticated intent without obscuring the source text.
const start = '\u{E0001}'
const separator = '\u{E0002}'
const end = '\u{E007F}'
const markerPattern =
  /\u{E0001}([^\u{E0001}\u{E0002}]*)\u{E0002}([\u{E0020}-\u{E007E}]+)\u{E007F}/gu

export function stripTranslationMarkers(text: string): string {
  return text
    .replace(
      /\u{E0001}([^\u{E0001}\u{E0002}]*)(?:\u{E0002}[\u{E0020}-\u{E007E}]*(?:\u{E007F})?)?/gu,
      '$1'
    )
    .replace(/\u{E0002}[\u{E0020}-\u{E007E}]*(?:\u{E007F})?/gu, '')
}

function decodeMarker(encoded: string): [string, TranslationParams] | undefined {
  const token = Array.from(encoded, (char) =>
    String.fromCharCode(char.codePointAt(0)! - 0xe0000)
  ).join('')
  const match = /^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/.exec(token)
  if (!match || digest(match[1]) !== match[2]) return undefined
  try {
    const parsed: unknown = JSON.parse(Buffer.from(match[1], 'base64url').toString())
    if (
      !Array.isArray(parsed) ||
      typeof parsed[0] !== 'string' ||
      !parsed[1] ||
      typeof parsed[1] !== 'object' ||
      Array.isArray(parsed[1])
    )
      return undefined
    if (
      !Object.values(parsed[1]).every(
        (value) => typeof value === 'string' || typeof value === 'number'
      )
    )
      return undefined
    return parsed as [string, TranslationParams]
  } catch {
    return undefined
  }
}
// Adonis loads APP_KEY before providers/definitions; standalone tests use a process-local key.
const markerKey = process.env.APP_KEY ?? randomBytes(32)

function digest(payload: string): string {
  return createHmac('sha256', markerKey).update(payload).digest('hex')
}

function encodeTranslation(key: string, params?: TranslationParams): string {
  const sorted =
    params && Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)))
  const payload = Buffer.from(JSON.stringify([key, sorted ?? {}])).toString('base64url')
  const encoded = Array.from(`${payload}.${digest(payload)}`, (char) =>
    String.fromCodePoint(0xe0000 + char.charCodeAt(0))
  ).join('')
  const visible = resolveTranslations(interpolate(key, params), 'en')
  return `${start}${visible}${separator}${encoded}${end}`
}

/** Lazy, deterministic marker: definitions may be declared outside a request. */
export function t(key: string, params?: TranslationParams): string {
  return encodeTranslation(key, params)
}

/** True only for complete, checksummed framework translation markers. */
export function isTranslationMarker(value: string): boolean {
  const matches = [...value.matchAll(markerPattern)]
  return (
    matches.length === 1 &&
    matches[0].index === 0 &&
    matches[0][0].length === value.length &&
    Boolean(decodeMarker(matches[0][2]))
  )
}

export function interpolate(message: string, params: TranslationParams = {}): string {
  return message.replace(/\{([\w]+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder
  )
}

export function translate(
  key: string,
  locale: string,
  messages: MessageDictionary = {},
  params: TranslationParams = {}
): string {
  const message = Object.hasOwn(messages, key) ? messages[key] : key
  if (typeof message === 'string') return interpolate(message, params)
  const count = Number(params.count)
  const category = new Intl.PluralRules(locale).select(count)
  return interpolate(
    count === 0 && message.zero !== undefined
      ? message.zero
      : category === 'one'
        ? message.one
        : message.other,
    params
  )
}

/** Built-ins, plugins in declaration order, then host overrides. Fallback is per key. */
export function getMessages(
  config: Pick<PupitreConfig, 'i18n'>,
  panel: Pick<PanelDefinition, 'plugins'> | undefined,
  locale: string
): MessageDictionary {
  const forLocale = (language: string): MessageDictionary =>
    Object.assign(
      Object.create(null) as MessageDictionary,
      language === 'id'
        ? id
        : language === 'en'
          ? {
              '{count} active query rules': {
                one: '{count} active query rule',
                other: '{count} active query rules',
              },
              '{count} rows': { one: '{count} row', other: '{count} rows' },
            }
          : {},
      ...(panel?.plugins ?? []).map((plugin) => plugin.messages?.[language] ?? {}),
      config.i18n?.messages?.[language] ?? {}
    )
  const fallback = config.i18n?.fallbackLocale ?? 'en'
  const base = locale.split('-')[0].toLowerCase()
  return {
    ...(base === 'en' ? {} : forLocale(fallback)),
    ...forLocale(base),
    ...(locale === base ? {} : forLocale(locale)),
  }
}

/** Resolve only authenticated markers; ordinary record strings are never translated. */
export function resolveTranslations<T>(
  value: T,
  locale: string,
  messages: MessageDictionary = {}
): T {
  const seen = new WeakMap<object, unknown>()
  const resolve = (input: unknown): unknown => {
    if (typeof input === 'string')
      return stripTranslationMarkers(
        input.replace(markerPattern, (_marker, visible: string, encoded: string) => {
          const decoded = decodeMarker(encoded)
          if (!decoded) return visible
          const [key, params] = decoded
          return String(
            resolve(
              translate(
                key,
                locale,
                messages,
                Object.fromEntries(
                  Object.entries(params).map(([name, item]) => [name, resolve(item)])
                ) as TranslationParams
              )
            )
          )
        })
      )
    if (typeof input === 'function')
      return function (this: unknown, ...args: unknown[]) {
        return resolve(Reflect.apply(input, this, args))
      }
    if (input instanceof Promise) return input.then(resolve)
    if (!input || typeof input !== 'object') return input
    const cached = seen.get(input)
    if (cached) return cached
    if (
      !Array.isArray(input) &&
      Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null
    )
      return input
    const result: unknown[] | Record<PropertyKey, unknown> = Array.isArray(input) ? [] : {}
    seen.set(input, result)
    for (const key of Reflect.ownKeys(input)) {
      if (Array.isArray(input) && key === 'length') continue
      Object.defineProperty(result, key, {
        enumerable: Object.getOwnPropertyDescriptor(input, key)?.enumerable ?? false,
        configurable: true,
        writable: true,
        value: resolve(Reflect.get(input, key)),
      })
    }
    return result
  }
  return resolve(value) as T
}

/** Resolve the supported locale in user → session → language header → default order. */
export function resolveLocale(options: {
  user?: unknown
  session?: unknown
  acceptLanguage?: string
  locales?: readonly string[]
  defaultLocale?: string
}): string {
  const supported = options.locales?.length ? options.locales : [options.defaultLocale ?? 'en']
  for (const preferred of [options.user, options.session]) {
    if (typeof preferred === 'string' && supported.includes(preferred)) return preferred
  }
  const languages = (options.acceptLanguage ?? '')
    .split(',')
    .map((entry, index) => {
      const [tag, quality] = entry.trim().split(';')
      const q = quality ? Number(quality.trim().replace(/^q=/, '')) : 1
      return { tag: tag.toLowerCase(), q, index }
    })
    .filter(({ q }) => Number.isFinite(q) && q > 0 && q <= 1)
    .sort((a, b) => b.q - a.q || a.index - b.index)
  for (const { tag } of languages) {
    if (tag === '*') return options.defaultLocale ?? supported[0]
    const exact = supported.find((candidate) => candidate.toLowerCase() === tag)
    const base = supported.find(
      (candidate) => candidate.toLowerCase().split('-')[0] === tag.split('-')[0]
    )
    if (exact ?? base) return (exact ?? base)!
  }
  return options.defaultLocale ?? 'en'
}

export function validateMessages(messages: unknown): asserts messages is LocaleMessages {
  if (!messages || typeof messages !== 'object' || Array.isArray(messages))
    throw new Error('Messages must be locale dictionaries')
  for (const [locale, dictionary] of Object.entries(messages)) {
    new Intl.PluralRules(locale)
    if (!dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary))
      throw new Error(`Invalid messages for ${locale}`)
    for (const message of Object.values(dictionary)) {
      if (typeof message === 'string') continue
      if (
        !message ||
        typeof message !== 'object' ||
        !('one' in message) ||
        typeof message.one !== 'string' ||
        !('other' in message) ||
        typeof message.other !== 'string' ||
        ('zero' in message && message.zero !== undefined && typeof message.zero !== 'string')
      )
        throw new Error(`Invalid plural message for ${locale}`)
    }
  }
}

export type StoredTranslation = {
  parts: (
    | string
    | {
        key: string
        params: Record<string, string | number | { text: string; translation: StoredTranslation }>
      }
  )[]
}

/** Persist readable source text and structured intent, never an APP_KEY-bound envelope. */
export function captureTranslation(text: string): {
  text: string
  translation?: StoredTranslation
} {
  const parts: StoredTranslation['parts'] = []
  let cursor = 0
  for (const match of text.matchAll(markerPattern)) {
    const decoded = decodeMarker(match[2])
    if (!decoded) continue
    const [key, values] = decoded
    parts.push(stripTranslationMarkers(text.slice(cursor, match.index)))
    const params = Object.fromEntries(
      Object.entries(values).map(([name, value]) => {
        if (typeof value !== 'string') return [name, value]
        const stored = captureTranslation(value)
        return [
          name,
          stored.translation ? { text: stored.text, translation: stored.translation } : value,
        ]
      })
    )
    parts.push({ key, params })
    cursor = match.index + match[0].length
  }
  if (!parts.length) return { text: stripTranslationMarkers(text) }
  parts.push(stripTranslationMarkers(text.slice(cursor)))
  return { text: resolveTranslations(text, 'en'), translation: { parts } }
}

/** Reissue trusted stored intent with the active key; the request boundary translates it. */
export function restoreTranslation(source: string, stored: unknown): string {
  if (!stored || typeof stored !== 'object' || !('parts' in stored) || !Array.isArray(stored.parts))
    return source
  const output: string[] = []
  for (const part of stored.parts) {
    if (typeof part === 'string') {
      output.push(part)
      continue
    }
    if (
      !part ||
      typeof part !== 'object' ||
      typeof part.key !== 'string' ||
      !part.params ||
      typeof part.params !== 'object' ||
      Array.isArray(part.params)
    )
      return source
    const params: TranslationParams = {}
    for (const [name, value] of Object.entries(part.params)) {
      if (typeof value === 'string' || typeof value === 'number') params[name] = value
      else if (
        value &&
        typeof value === 'object' &&
        'text' in value &&
        typeof value.text === 'string' &&
        'translation' in value
      )
        params[name] = restoreTranslation(value.text, value.translation)
      else return source
    }
    output.push(encodeTranslation(part.key, params))
  }
  return output.join('')
}
