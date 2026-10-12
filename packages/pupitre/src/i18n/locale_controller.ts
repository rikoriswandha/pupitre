import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { PupitreConfig } from '../define_config.js'
import { t } from '../i18n.js'

/** Persist the preference even for hosts that have not installed the optional column. */
export async function persistLocale(ctx: HttpContext, locale: string): Promise<void> {
  const config = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
  ctx.session?.put(`pupitre.locale.${ctx.pupitre.panel.id}`, locale)
  const user = ctx.pupitre.authUser
  if (user) {
    const model = user.constructor as LucidModel
    if (model.$hasColumn(config.auth.columns.locale)) {
      user.merge({ [config.auth.columns.locale]: locale })
      await user.save()
    }
  }
  ctx.pupitre.locale = locale
}

export default class LocaleController {
  async update(ctx: HttpContext) {
    const locale = ctx.request.input('locale') as unknown
    const supported = ctx.pupitre.panel.locales ?? [ctx.pupitre.panel.locale ?? 'en']
    if (typeof locale !== 'string' || !supported.includes(locale))
      return ctx.response.unprocessableEntity({ message: t('Choose an available language.') })
    await persistLocale(ctx, locale)
    return ctx.response.redirect().back()
  }
}
