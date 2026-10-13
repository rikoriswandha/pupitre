import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { PupitrePageProps } from '../../catalog/wire.js'

export async function environmentProps(
  ctx: HttpContext,
  environment = { inProduction: app.inProduction, nodeEnvironment: app.nodeEnvironment }
): Promise<PupitrePageProps['pupitre']['environment']> {
  const options = ctx.pupitre.panel.environmentIndicator
  if (!options) return undefined
  const visible =
    typeof options.visible === 'function'
      ? await options.visible(ctx)
      : (options.visible ?? !environment.inProduction)
  if (!visible) return undefined
  return { label: options.label ?? environment.nodeEnvironment, color: options.color ?? 'warning' }
}
