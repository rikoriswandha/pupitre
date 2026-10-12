import { getMessages, requestMessages, resolveTranslations, t } from './i18n.js'
import { createError } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

type ErrorContext = HttpContext & {
  session?: { flash(key: string, value: unknown): void }
  pupitre?: { panel: { path: string; tenancy?: unknown }; tenant?: unknown }
}

function handledError(message: string, status: number, code: string) {
  const ErrorClass = createError(message, code, status)
  ;(
    ErrorClass.prototype as typeof ErrorClass.prototype & {
      handle(error: Error, ctx: ErrorContext): unknown
    }
  ).handle = function (error: Error, ctx: ErrorContext) {
    const acceptsJson = ctx.request
      .header('accept')
      ?.split(',')
      .some((mediaType) => mediaType.split(';', 1)[0]?.trim() === 'application/json')
    const json = ctx.request.header('x-pupitre-action') === '1' || acceptsJson
    const locale = ctx.pupitre?.locale ?? 'en'
    const messages = requestMessages.get(ctx) ?? getMessages({}, undefined, locale)
    const translated = resolveTranslations(error.message, locale, messages)
    if (json) return ctx.response.status(status).json({ message: translated })
    if (status === 403) {
      if (ctx.pupitre?.panel.tenancy && !ctx.pupitre.tenant)
        return ctx.response.status(status).send(translated)
      const referer = ctx.request.header('referer')
      const panelPath = ctx.pupitre?.panel.path
      if (referer && panelPath) {
        try {
          const path = new URL(referer).pathname.replace(/\/$/, '')
          if (path === panelPath || path === `${panelPath}/login`)
            return ctx.response.status(status).send(translated)
        } catch {}
      }
      ctx.session?.flash('pupitre', [{ type: 'error', title: t('Forbidden'), body: error.message }])
      return ctx.response.redirect().back()
    }
    if (ctx.request.header('x-inertia') && ctx.session) {
      ctx.session.flash('pupitre', [
        {
          type: 'error',
          title: t('Request failed'),
          body: error.message,
        },
      ])
      return ctx.response.redirect().back()
    }
    return ctx.response.status(status).send(translated)
  }
  return ErrorClass
}

export const E_PUPITRE_FORBIDDEN = handledError(
  t('You are not authorized to perform this action'),
  403,
  'E_PUPITRE_FORBIDDEN'
)
export const E_PUPITRE_NOT_FOUND = createError(
  t('The requested record was not found'),
  'E_PUPITRE_NOT_FOUND',
  404
)

export const E_PUPITRE_MISSING_PEER = createError(
  'An optional Pupitre peer dependency is required for this feature',
  'E_PUPITRE_MISSING_PEER',
  500
)
export const E_PUPITRE_INVALID_ACTION_CONTEXT = createError(
  'Asynchronous execution is supported only for bulk actions and imports',
  'E_PUPITRE_INVALID_ACTION_CONTEXT',
  400
)
export const E_PUPITRE_MAIL_ADAPTER_REQUIRED = createError(
  'A mail adapter is required when password reset or email verification is enabled',
  'E_PUPITRE_MAIL_ADAPTER_REQUIRED',
  500
)
export const E_PUPITRE_BOUNCER_NOT_INITIALIZED = createError(
  'A resource policy is configured but Bouncer is not initialized; register @adonisjs/bouncer initialize middleware',
  'E_PUPITRE_BOUNCER_NOT_INITIALIZED',
  500
)
export const E_PUPITRE_INVALID_UPLOAD = handledError(
  t('The uploaded file is invalid'),
  422,
  'E_PUPITRE_INVALID_UPLOAD'
)
export const E_PUPITRE_UPLOAD_NOT_OWNED = handledError(
  t('The uploaded file does not belong to this session'),
  403,
  'E_PUPITRE_UPLOAD_NOT_OWNED'
)
export const E_PUPITRE_UPLOAD_TOO_LARGE = handledError(
  t('The uploaded file exceeds the maximum size'),
  413,
  'E_PUPITRE_UPLOAD_TOO_LARGE'
)

export const E_PUPITRE_INVALID_ACTION_NAME = createError(
  'Action names must be non-numeric slugs',
  'E_PUPITRE_INVALID_ACTION_NAME',
  500
)
export const E_PUPITRE_INVALID_RESOURCE_SLUG = createError(
  'Resource slugs must be kebab-case',
  'E_PUPITRE_INVALID_RESOURCE_SLUG',
  500
)
export const E_PUPITRE_INVALID_PANEL_ID = createError(
  'Panel identifiers must be slugs',
  'E_PUPITRE_INVALID_PANEL_ID',
  500
)
export const E_PUPITRE_UNLIFTABLE_CLOSURE = createError(
  'The afterStateUpdated closure cannot be lifted into client state actions',
  'E_PUPITRE_UNLIFTABLE_CLOSURE',
  500
)
export const E_PUPITRE_INVALID_SPEC = createError(
  'The schema compiler produced an invalid json-render spec',
  'E_PUPITRE_INVALID_SPEC',
  500
)
