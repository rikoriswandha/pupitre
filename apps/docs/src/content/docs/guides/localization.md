---
title: Localization
sidebar:
  order: 15
---

Pupitre includes English (`en`, the source language) and Indonesian (`id`). Enable the languages on each panel:

```ts
export default definePanel('admin')
  .locale('en')
  .locales(['en', 'id'])
```

The user menu offers a language selector when more than one locale is enabled. A selection posts `{ locale }` to `${panel.path}/locale`, with the normal session authentication and CSRF protection, then returns to the current page. In URL-tenanted panels, use the already tenant-scoped `panel.path`; do not append the tenant again. The selected locale must belong to the panel's enabled list.

## Mark your application strings

The effective locale is resolved from the user preference, then the session, the best matching `Accept-Language` language, the panel default, and finally `en`. Only enabled panel locales may be selected. Request locale state is isolated; changing one user's language does not change another user's page.

Import `t` from `@rikology/pupitre` in server definitions, and from `@rikology/pupitre-react` in React components. Both have the same signature:

```ts
t(key: string, params?: Record<string, string | number>): string
```

Use literal English source text as the key and named `{name}` placeholders:

```ts
import { t } from '@rikology/pupitre'

schema.text('title').label(t('Title'))
const confirmation = t('Delete {label}?', { label: 'post' })
```

Never concatenate translated fragments or construct a key with a template literal. Pass variable values as parameters, not as keys. The server function returns readable, interpolated English source text with signed translation intent in invisible Unicode TAG characters. Pupitre resolves that intent on structured response props before rendering or serialization; it strips all framing, including truncated or unverifiable metadata. It never inserts translations into already-rendered HTML. The client function translates synchronously using the dictionary delivered in shared page props.

Unmarked strings and record data are not translated. Only Pupitre's marker framing is removed; unrelated Unicode TAG characters (including subdivision flag emoji) are preserved through forms and exports. Wrap host labels, navigation groups, validation copy, action text, and accessibility labels explicitly; a database value such as a post title stays the same when the language changes.

### Breaking server semantics

The server `t()` is no longer an identity function: its result is readable in logs, `Error.message`, regular expressions and `.includes()`, but strict equality with the English literal no longer holds. Resolve before truncating, wrapping, changing case, or sending a value outside Pupitre (mail subjects, Edge templates, custom adapters):

```ts
import { getMessages, resolveTranslations } from '@rikology/pupitre'

const subject = resolveTranslations(
  t('Your export is ready'),
  locale,
  getMessages(config, panel, locale)
)
```

For durable storage, use `captureTranslation(text)` to obtain readable `text` and optional structured `translation` metadata; restore it with `restoreTranslation(text, translation)` before resolving for the reader's locale. Official notifications, job errors and queued CSV headers use this pattern so application-key rotation does not lose intent. Never persist or forward signed framing directly. English requests always use source English and explicit English overrides, even when `fallbackLocale` is Indonesian.
Regional English locales such as `en-US` also use source English: base `en` plural forms and overrides are layered below regional overrides, without a non-English fallback. Validation errors use each field's rendered label (including the default humanized name), with repeater labels matched by wildcard paths.


## Add or override messages

Use `config/pupitre.ts` for host dictionaries:

```ts
export default defineConfig({
  i18n: {
    fallbackLocale: 'en',
    messages: {
      id: {
        Title: 'Judul',
        'Delete {label}?': 'Hapus {label}?',
        '{count} posts': {
          zero: 'Tidak ada postingan',
          one: '{count} postingan',
          other: '{count} postingan',
        },
      },
    },
  },
})
```

Call `t('{count} posts', { count })` with a numeric `count`. A message is either a string or `{ one, other, zero? }`. Plural selection uses `Intl.PluralRules(locale)`; an explicit `zero` handles zero before normal category selection, and unsupported categories use `other`. Keep placeholder names the same in all translations.

Plugins contribute the same dictionary shape without installing a client renderer:

```ts
export default definePlugin({
  name: 'editorial',
  messages: { id: { 'Editorial queue': 'Antrean editorial' } },
})
```

Pupitre sends `pupitre.locale`, optional `pupitre.messages` (the effective dictionary for package client strings, plus host/plugin additions), and optional `pupitre.locales` (enabled languages) to the client. Server-only built-in strings are omitted to keep the payload small. An unmodified source-English dictionary is omitted; the client uses the source key when there is no translation.

## User preferences and upgrades

The optional nullable `users.locale` column stores a user's preferred language. Publish the localization migration with `node ace pupitre:install`, then run `node ace migration:run`. Map the model's locale attribute through `auth.columns.locale` if the host uses a different property name. Declare the corresponding Lucid attribute on your User model. Without the optional column, language selection remains session-based; a null preference falls through to session, Accept-Language, and the panel default.

## Number formats

Numbers and money use a number locale that is separate from the interface language, so an English interface can still show `Rp 1.234.567` or `1 234,5`. Set the panel default and, optionally, the formats users can pick:

```ts
export default definePanel('admin')
  .locales(['en', 'id'])
  .numberLocale('id-ID') // default for everyone; omit to follow the UI language
  .numberLocales(['id-ID', 'en-US', 'de-CH']) // profile choices; [] hides the choice
```

The profile shows a "Number format" select whose options are labelled with a sample (`1.234.567,89 · Indonesia`); without `.numberLocales()` it offers one region per common separator style (`en-US`, `id-ID`, `fr-FR`, `de-CH`, `en-IN`, plus the panel default). "Default" clears the preference. The effective number locale is resolved from the user preference, then the session, then `.numberLocale()`, then the UI language. Values outside the offered choices are ignored. The optional nullable `users.number_locale` column (migration `1791800000024_add_pupitre_number_locale_to_users`, mapped through `auth.columns.numberLocale`, default `numberLocale`) persists the choice across devices; without it the choice is session-based.

The number locale applies to `.money()` and `.numeric()` table columns, entries and summaries, numeric stat values, chart axes and tooltips, and the client `formatNumber` computed function. Pupitre sends it to the client as `pupitre.numberLocale`; React code can use `formatNumber(value, options)` and `getNumberLocale()` from `@rikology/pupitre-react`.

### Compact numbers

Long values can be shortened with `.compact()`. Abbreviations follow the number locale's CLDR rules: `1500` is `1.5K` in `en-US` and `1,5 rb` in `id-ID`, `105913958` is `105.9M` or `105,9 jt`. The full value stays available as a tooltip, and copyable entries copy the full value.

```ts
table.text('revenue').money('IDR').compact()
schema.textEntry('views').numeric().compact()
stat('Revenue', 105_913_958).money('IDR').compact()
```

`.compact()` affects `money`/`numeric` values only. Stat values given as numbers are always formatted with the number locale (`.money(currency)` renders them as money); strings are shown as given. Some locales compact only from a million upward (`de-DE` prints `1000`).

## Translation coverage

From the repository root, run `npm run i18n:check`. It runs the checker tests and scans the `src` trees of the core, React, UI, Shield, Audit, Settings, and Transmit packages. Every literal `t('…')` key must have a nonempty Indonesian message. Dynamic keys, absent arguments, malformed source, missing messages, and incomplete plural messages fail the command with source locations. Host app and plugin authors should apply the same literal-key rule to their own dictionaries; the repository checker does not scan application record data.
