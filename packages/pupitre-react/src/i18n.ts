export type TranslationMessage = string | { one: string; other: string; zero?: string }
export type TranslationMessages = Record<string, TranslationMessage>

let locale = 'en'
let numberLocale: string | undefined
let messages: TranslationMessages | undefined
let pluralRules = new Intl.PluralRules(locale)

/** Install the current Inertia page's translations before rendering its children. */
export function configureI18n(
  nextLocale: string,
  nextMessages?: TranslationMessages,
  nextNumberLocale?: string
): void {
  if (locale !== nextLocale) {
    locale = nextLocale
    pluralRules = new Intl.PluralRules(locale)
  }
  messages = nextMessages
  numberLocale = nextNumberLocale
}

/** Locale for number and money separators: the user's/panel's choice, else the UI locale. */
export function getNumberLocale(): string {
  return numberLocale ?? locale
}

/** Formats a number with the request's number locale; `compact` shortens it (`1,5 jt`, `1.5K`). */
export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions & { compact?: boolean } = {}
): string {
  const { compact, ...format } = options
  return new Intl.NumberFormat(getNumberLocale(), {
    ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
    ...format,
  }).format(value)
}

/** Translate English source text, retaining missing messages and placeholders verbatim. */
export function t(key: string, params?: Record<string, string | number>): string {
  const message = messages && Object.hasOwn(messages, key) ? messages[key] : undefined
  let value = key
  if (typeof message === 'string') value = message
  else if (message) {
    const count = params?.count === undefined ? undefined : Number(params.count)
    value =
      typeof count === 'number' && count === 0 && message.zero !== undefined
        ? message.zero
        : typeof count === 'number' && pluralRules.select(count) === 'one'
          ? message.one
          : message.other
  }
  if (!params) return value
  return value.replace(/\{([^{}]+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder
  )
}
