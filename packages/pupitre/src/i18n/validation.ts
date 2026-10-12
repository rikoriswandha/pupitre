import vine from '@vinejs/vine'
import type { FieldContext } from '@vinejs/vine/types'
import type { HttpContext } from '@adonisjs/core/http'
import { requestMessages, resolveTranslations, translate } from '../i18n.js'

/** Per-validation provider; cached validators never retain another request's language. */
export function validationMessages(ctx?: HttpContext, labels: Record<string, string> = {}) {
  const locale = ctx?.pupitre?.locale ?? 'en'
  const dictionary = ctx ? (requestMessages.get(ctx) ?? {}) : {}
  return {
    getMessage(
      defaultMessage: string,
      rule: string,
      field: FieldContext,
      args?: Record<string, unknown>
    ): string {
      const key = defaultMessage.replace(/\{\{\s*(\w+)\s*\}\}/g, '{$1}')
      if (!Object.hasOwn(dictionary, key))
        return resolveTranslations(
          vine.messagesProvider.getMessage(defaultMessage, rule, field, args),
          locale,
          dictionary
        )
      const params = Object.fromEntries(
        Object.entries({
          ...args,
          field: resolveTranslations(
            labels[field.getFieldPath()] ??
              labels[field.wildCardPath] ??
              labels[field.name] ??
              field.name,
            locale,
            dictionary
          ),
        }).map(([name, value]) => [name, typeof value === 'number' ? value : String(value)])
      )
      const message = resolveTranslations(
        translate(key, locale, dictionary, params),
        locale,
        dictionary
      )
      return locale === 'id' && !/[.!?]$/.test(message) ? `${message}.` : message
    },
  }
}
