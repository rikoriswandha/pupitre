import * as abilities from '#abilities/main'
import { policies } from '#generated/policies'
import { Bouncer } from '@adonisjs/bouncer'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class InitializeBouncerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.bouncer = new Bouncer(() => ctx.auth.user || null, abilities, policies).setContainerResolver(
      ctx.containerResolver
    )
    return next()
  }
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    bouncer: Bouncer<Exclude<HttpContext['auth']['user'], undefined>, typeof abilities, typeof policies>
  }
}
