import { createError } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

type ErrorContext = HttpContext & {
  session?: { flash(key: string, value: unknown): void }
}

function handledError(message: string, status: number, code: string) {
  const ErrorClass = createError(message, code, status)
  ;(
    ErrorClass.prototype as typeof ErrorClass.prototype & {
      handle(error: Error, ctx: ErrorContext): unknown
    }
  ).handle = function (error: Error, ctx: ErrorContext) {
    const json =
      ctx.request.header('x-pupitre-action') === '1' ||
      (!ctx.request.header('x-inertia') && ctx.request.accepts(['json', 'html']) === 'json')
    if (json) return ctx.response.status(status).json({ message: error.message })
    if (ctx.request.header('x-inertia') && ctx.session) {
      ctx.session.flash('pupitre', [
        {
          type: 'error',
          title: status === 403 ? 'Forbidden' : 'Request failed',
          body: error.message,
        },
      ])
      return ctx.response.redirect().back()
    }
    return ctx.response.status(status).send(error.message)
  }
  return ErrorClass
}

export const E_PUPITRE_FORBIDDEN = handledError(
  'You are not authorized to perform this action',
  403,
  'E_PUPITRE_FORBIDDEN'
)

export const E_PUPITRE_BOUNCER_NOT_INITIALIZED = createError(
  'A resource policy is configured but Bouncer is not initialized; register @adonisjs/bouncer initialize middleware',
  'E_PUPITRE_BOUNCER_NOT_INITIALIZED',
  500
)
export const E_PUPITRE_INVALID_UPLOAD = handledError(
  'The uploaded file is invalid',
  422,
  'E_PUPITRE_INVALID_UPLOAD'
)
export const E_PUPITRE_UPLOAD_NOT_OWNED = handledError(
  'The uploaded file does not belong to this session',
  403,
  'E_PUPITRE_UPLOAD_NOT_OWNED'
)
export const E_PUPITRE_UPLOAD_TOO_LARGE = handledError(
  'The uploaded file exceeds the maximum size',
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
