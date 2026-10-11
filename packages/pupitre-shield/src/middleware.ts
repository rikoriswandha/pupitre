import { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { shieldAllows } from './permissions.js'
export default async function shieldContextMiddleware(ctx: HttpContext, next: NextFn) {
  ctx.containerResolver.bindValue(HttpContext, ctx)
  const user = ctx.pupitre?.authUser ?? Reflect.get(ctx, 'auth')?.user
  if (user) await shieldAllows(ctx, user, '')
  return next()
}
