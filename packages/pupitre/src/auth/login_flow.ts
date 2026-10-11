import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { PanelRuntime } from '../manager.js'
import type { PupitreConfig } from '../define_config.js'

type Auth = {
  use(name: string): { login(user: LucidRow, remember?: boolean): Promise<void> }
}

export type LoginOptions = {
  remember?: boolean
  redirect?: string
  /** Passkey assertions already satisfy the panel MFA requirement. */
  mfaSatisfied?: boolean
}

/** Completes authentication or stores a short-lived MFA continuation in the session. */
export async function completeLogin(
  ctx: HttpContext,
  panel: PanelRuntime,
  user: LucidRow,
  options: LoginOptions = {}
) {
  const attributes = user.$attributes as Record<string, unknown>
  const config = (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
  const guard = panel.guard ?? 'web'
  const mfaEnabled = attributes[config.auth.columns.mfaEnabledAt]
  if (panel.auth.mfa && mfaEnabled && !options.mfaSatisfied) {
    ctx.session?.put('pupitre.pendingLogin', {
      userId: String(user.$primaryKeyValue),
      guard,
      remember: options.remember ?? false,
      redirect: options.redirect ?? panel.path,
      expiresAt: Date.now() + 5 * 60 * 1000,
    })
    return ctx.response.redirect(`${panel.path}/mfa/challenge`)
  }
  await (ctx as unknown as { auth: Auth }).auth.use(guard).login(user, options.remember)
  return ctx.response.redirect(options.redirect ?? panel.path)
}
