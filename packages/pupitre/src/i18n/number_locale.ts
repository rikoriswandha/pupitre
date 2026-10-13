import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { PupitreConfig } from '../define_config.js'
import type { PanelDefinition } from '../definition/panel.js'
import { t } from '../i18n.js'

/**
 * Profile choices when a panel declares none: one region per common separator style
 * (`1,234.5`, `1.234,5`, `1 234,5`, `1'234.5`, `12,34,567.5`).
 */
export const DEFAULT_NUMBER_LOCALES = ['en-US', 'id-ID', 'fr-FR', 'de-CH', 'en-IN'] as const
/** Profile value meaning "format numbers like the interface language". */
export const AUTO_NUMBER_LOCALE = 'auto'

const SAMPLE = 1234567.89

/** Canonical BCP 47 tag the runtime can format numbers with; throws otherwise. */
export function supportedNumberLocale(value: string): string {
  const [canonical] = Intl.getCanonicalLocales(value)
  if (!canonical || Intl.NumberFormat.supportedLocalesOf([canonical]).length === 0)
    throw new Error(`Unsupported number locale "${value}"`)
  return canonical
}

export function numberLocaleChoices(
  panel: Pick<PanelDefinition, 'numberLocale' | 'numberLocales'>
): string[] {
  const choices: string[] = [...(panel.numberLocales ?? DEFAULT_NUMBER_LOCALES)]
  if (
    panel.numberLocales === undefined &&
    panel.numberLocale &&
    !choices.includes(panel.numberLocale)
  )
    choices.unshift(panel.numberLocale)
  return choices
}

/** User column → session → panel `.numberLocale()` → UI locale. */
export function resolveNumberLocale(options: {
  user?: unknown
  session?: unknown
  panel: Pick<PanelDefinition, 'numberLocale' | 'numberLocales'>
  locale: string
}): string {
  const choices = numberLocaleChoices(options.panel)
  for (const preferred of [options.user, options.session]) {
    if (typeof preferred === 'string' && choices.includes(preferred)) return preferred
  }
  return options.panel.numberLocale ?? options.locale
}

/**
 * Profile select options labelled with a formatted sample, e.g. `1.234.567,89 · Indonesia`.
 * The first option clears the preference and follows the panel default (or UI language).
 */
export function numberLocaleOptions(
  uiLocale: string,
  defaultLocale: string,
  choices: readonly string[]
) {
  const regions = new Intl.DisplayNames([uiLocale], { type: 'region' })
  return [
    {
      value: AUTO_NUMBER_LOCALE,
      label: t('Default ({example})', {
        example: new Intl.NumberFormat(defaultLocale).format(SAMPLE),
      }),
    },
    ...choices.map((locale) => {
      const region = new Intl.Locale(locale).maximize().region
      const sample = new Intl.NumberFormat(locale).format(SAMPLE)
      return { value: locale, label: region ? `${sample} · ${regions.of(region)}` : sample }
    }),
  ]
}

/** Persists the choice in the session and, when installed, the optional users column. */
export async function persistNumberLocale(ctx: HttpContext, value: string | null): Promise<void> {
  const config = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
  const key = `pupitre.numberLocale.${ctx.pupitre.panel.id}`
  if (value === null) ctx.session?.forget(key)
  else ctx.session?.put(key, value)
  const user = ctx.pupitre.authUser
  const column = config.auth.columns.numberLocale
  if (user && column && (user.constructor as LucidModel).$hasColumn(column)) {
    user.merge({ [column]: value })
    await user.save()
  }
  ctx.pupitre.numberLocale = resolveNumberLocale({
    session: value,
    panel: ctx.pupitre.panel,
    locale: ctx.pupitre.locale,
  })
}
