import type { HttpContext } from '@adonisjs/core/http'
import type { ActionResult } from '../../catalog/wire.js'

export function isPupitreActionRequest(ctx: HttpContext): boolean {
  return ctx.request.header('x-pupitre-action') === '1'
}

export function actionJson(ctx: HttpContext, result: ActionResult, status = 200) {
  return ctx.response.status(status).json(result)
}

export function errorJson(
  ctx: HttpContext,
  message: string,
  status: number,
  errors?: Record<string, string[]>
) {
  return ctx.response.status(status).json(errors ? { errors } : { message })
}

export function setPupitreFlash(ctx: HttpContext, value: unknown) {
  const session = (ctx as HttpContext & { session?: { flash(key: string, value: unknown): void } })
    .session
  session?.flash('pupitre', value)
}
