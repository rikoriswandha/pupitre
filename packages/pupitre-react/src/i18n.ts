export type TranslationMessage = string | { one: string; other: string; zero?: string }
export type TranslationMessages = Record<string, TranslationMessage>

let locale = 'en'
let messages: TranslationMessages | undefined
let pluralRules = new Intl.PluralRules(locale)

/** Install the current Inertia page's translations before rendering its children. */
export function configureI18n(nextLocale: string, nextMessages?: TranslationMessages): void {
  if (locale !== nextLocale) {
    locale = nextLocale
    pluralRules = new Intl.PluralRules(locale)
  }
  messages = nextMessages
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
