import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { isPassiveImageMime, readUploadBytes } from '../storage/upload_validation.js'
import { fileTypeFromBuffer } from 'file-type'
import type { MultipartFile } from '@adonisjs/bodyparser'
import { createPupitreStorage } from '../storage/index.js'
import app from '@adonisjs/core/services/app'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { schema } from '../builder/schema/schema.js'
import { compileForm } from '../compiler/schema_compiler.js'
import { resolveAdapter, type PupitreConfig } from '../define_config.js'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { PanelRuntime } from '../manager.js'
import { buildPanelPageProps, pageKey, panelBreadcrumb } from '../http/page_props.js'
import type { FormDescriptor } from '../../catalog/index.js'
import type { SchemaNodeBuilder, SchemaNodeDefinition } from '../definition/schema.js'
import { clearLoginLimit, consumeLoginLimit } from '../drivers/limiter.js'
import { authLimitResponse, authRateLimited } from './rate_limit.js'
import { panelGuard } from './guard.js'
import { E_PUPITRE_FORBIDDEN, E_PUPITRE_MAIL_ADAPTER_REQUIRED } from '../errors.js'
import { requestMessages, resolveTranslations, t } from '../i18n.js'
import { persistLocale } from '../i18n/locale_controller.js'
import {
  AUTO_NUMBER_LOCALE,
  numberLocaleChoices,
  numberLocaleOptions,
  persistNumberLocale,
} from '../i18n/number_locale.js'
import { validationMessages } from '../i18n/validation.js'
import { completeLogin } from './login_flow.js'
import { recordAuthEvent, revokeCurrentSession } from './session_service.js'
import { consumeMfaLimit, clearMfaLimit } from './mfa_limit.js'
import { consumeRecoveryCode } from './recovery_code.js'
import { verifyTotp } from './totp.js'
import { createTotpEnrollment, makeRecoveryCodes } from './mfa_setup.js'
import {
  authenticationOptions,
  deletePasskey,
  listPasskeys,
  registrationOptions,
  renamePasskey,
  verifyAuthentication,
  verifyRegistration,
} from './passkey_service.js'

const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    password: vine.string().minLength(1),
  })
)
const emailValidator = vine.compile(vine.object({ email: vine.string().trim().email() }))
const profileValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).optional(),
    email: vine.string().trim().email().optional(),
    password: vine.string().minLength(8).optional(),
    password_confirmation: vine.string().minLength(8).optional(),
    current_password: vine.string().optional(),
  })
)
const resetValidator = vine.compile(
  vine.object({
    password: vine.string().minLength(8),
    password_confirmation: vine.string().minLength(8),
  })
)
const registrationValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    email: vine.string().trim().email(),
    password: vine.string().minLength(8),
  })
)
const mfaChallengeValidator = vine.compile(
  vine.object({
    code: vine.string().trim().optional(),
    recovery_code: vine.string().trim().optional(),
  })
)
const passkeyNameValidator = vine.compile(
  vine.object({ name: vine.string().trim().minLength(1).maxLength(100) })
)
type AuthContext = HttpContext & {
  pupitre: HttpContext['pupitre'] & { panel: PanelRuntime }
}
type PanelAuth = {
  use(name: string): {
    check(): Promise<boolean>
    login(user: LucidRow): Promise<void>
    logout(): Promise<void>
  }
}
function panelAuth(ctx: HttpContext): PanelAuth {
  return (ctx as unknown as { auth: PanelAuth }).auth
}
type ResetQuery = {
  where(key: string, value: unknown): ResetQuery
  where(key: string, operator: string, value: unknown): ResetQuery
  delete(): Promise<unknown>
  first(): Promise<Record<string, unknown> | undefined>
}
type ResetDb = {
  from(table: string): ResetQuery
  table(table: string): { insert(row: unknown): Promise<unknown> }
}
type AuthUserModel = LucidModel & {
  find(id: string | number): Promise<LucidRow | null>
  findBy(key: string, value: unknown): Promise<LucidRow | null>
  create(data: Record<string, unknown>): Promise<LucidRow>
  verifyCredentials(email: string, password: string): Promise<LucidRow>
}
type MutableUser = LucidRow & {
  $attributes: Record<string, unknown>
  merge(data: Record<string, unknown>): MutableUser
  save(): Promise<unknown>
}

type ProfileAvatarUpload = { key: string; userId: string }

function profileAvatarUploads(ctx: HttpContext): ProfileAvatarUpload[] {
  const uploads = ctx.session?.get('pupitre.profileAvatarUploads')
  if (!Array.isArray(uploads)) return []
  return uploads.filter((upload): upload is ProfileAvatarUpload =>
    Boolean(
      upload &&
      typeof upload === 'object' &&
      'key' in upload &&
      typeof upload.key === 'string' &&
      'userId' in upload &&
      typeof upload.userId === 'string'
    )
  )
}

async function config(ctx: HttpContext) {
  return (await ctx.containerResolver.make('pupitre.config')) as PupitreConfig
}
async function userModel(cfg: PupitreConfig): Promise<AuthUserModel> {
  if (!cfg.auth.model)
    throw new Error(
      'E_PUPITRE_AUTH_MODEL_REQUIRED: configure pupitre.auth.model to enable panel authentication'
    )
  const modelModule = await cfg.auth.model()
  return modelModule.default as AuthUserModel
}
type AuthSchemaInput = SchemaNodeDefinition | SchemaNodeBuilder
function authSchemaDefinition(node: AuthSchemaInput): SchemaNodeDefinition {
  const builder = node as SchemaNodeBuilder
  return typeof builder.toDefinition === 'function'
    ? builder.toDefinition()
    : (node as SchemaNodeDefinition)
}
function loginForm(): AuthSchemaInput[] {
  return [
    schema.email('email').required().label(t('Email')),
    schema.password('password').required().label(t('Password')),
  ]
}
function formDescriptor(
  url: string,
  submitLabel: string,
  method: FormDescriptor['method'] = 'post'
): FormDescriptor {
  return { method, url, submitLabel, dirtyGuard: false }
}
/** Submit button label per auth page title (defaults to the title). */
const submitLabels: Record<string, string> = {
  [t('Forgot password')]: t('Send reset link'),
  [t('Verify your email address')]: t('Resend verification email'),
  [t('Profile')]: t('Save'),
}
async function renderAuth(
  ctx: AuthContext,
  title: string,
  nodes: AuthSchemaInput[],
  action: string,
  method: FormDescriptor['method'] = 'post',
  kind: 'auth' | 'page' = 'auth',
  data: Record<string, unknown> = {},
  uploadUrls?: { upload: string; delete: string }
) {
  const definitions = nodes.map(authSchemaDefinition)
  const compiled = await compileForm(definitions, {
    locale: ctx.pupitre.locale,
    timezone: ctx.pupitre.timezone,
    ctx,
    form: formDescriptor(action, submitLabels[title] ?? title, method),
    data,
    ...(uploadUrls ? { uploadUrls } : {}),
  })
  const props = buildPanelPageProps({
    ctx,
    key:
      kind === 'page'
        ? pageKey(
            ctx,
            'profile',
            'edit',
            String(
              (ctx.pupitre.authUser as (LucidRow & { $attributes: Record<string, unknown> }) | null)
                ?.$attributes.id
            )
          )
        : `${ctx.pupitre.panel.id}:${kind}:${action}`,
    kind,
    title,
    breadcrumbs: [panelBreadcrumb(ctx)],
    spec: compiled.spec,
    state: compiled.state,
  })
  const render = ctx.inertia.render as unknown as (component: string, props: unknown) => unknown
  return render.call(ctx.inertia, 'pupitre', props)
}
function panelPath(ctx: AuthContext) {
  return ctx.pupitre.basePath
}

function safeRedirect(ctx: AuthContext, value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//'))
    return panelPath(ctx)
  try {
    const base = new URL(ctx.request.completeUrl())
    const target = new URL(value, base)
    return target.origin === base.origin
      ? `${target.pathname}${target.search}${target.hash}`
      : panelPath(ctx)
  } catch {
    return panelPath(ctx)
  }
}
async function decryptMfaSecret(encrypted: string): Promise<string> {
  // Encryption's service proxy requires a booted Adonis app; load only during MFA operations.
  const { default: encryption } = await import('@adonisjs/core/services/encryption')
  const secret = encryption.decrypt<string>(encrypted)
  if (typeof secret !== 'string') throw new Error('The stored MFA secret cannot be decrypted')
  return secret
}
async function encryptMfaSecret(secret: string): Promise<string> {
  const { default: encryption } = await import('@adonisjs/core/services/encryption')
  return encryption.encrypt(secret)
}
function flashErrors(ctx: AuthContext, errors: Record<string, string>) {
  // Adonis Inertia's BaseInertiaMiddleware reads field errors from this bag.
  ctx.session?.flash('inputErrorsBag', errors)
  return ctx.response.redirect().back()
}

async function sendVerification(ctx: AuthContext, user: LucidRow, cfg: PupitreConfig) {
  if (!cfg.mail) throw new E_PUPITRE_MAIL_ADAPTER_REQUIRED()
  const attributes = user.$attributes as Record<string, unknown>
  const email = String(attributes[cfg.auth.columns.email])
  const hash = createHash('sha1').update(email).digest('hex')
  // Resolve after router boot because route registration imports this controller earlier.
  const { default: router } = await import('@adonisjs/core/services/router')
  const signedUrl = router.makeSignedUrl(
    `${ctx.pupitre.panel.id}.auth.verification.verify`,
    { id: attributes.id, hash },
    { expiresIn: '7 days', purpose: 'pupitre-email-verification' }
  )
  const url = new URL(signedUrl, ctx.request.completeUrl()).toString()
  const adapter = await resolveAdapter(cfg.mail)
  await adapter?.send(
    resolveTranslations(
      {
        to: email,
        subject: t('Verify your email address'),
        text: t('Verify your email address: {url}', { url }),
        html: t('<p>Verify your email address: <a href="{url}">Continue</a></p>', { url }),
      },
      ctx.pupitre.locale,
      requestMessages.get(ctx) ?? {}
    )
  )
}
export default class AuthController {
  async loginPage(ctx: AuthContext) {
    await userModel(await config(ctx))
    if (
      await panelAuth(ctx)
        .use(panelGuard(ctx.pupitre.panel) ?? 'web')
        .check()
    )
      return ctx.response.redirect(panelPath(ctx))
    const target = safeRedirect(ctx, ctx.request.input('redirect'))
    return renderAuth(
      ctx,
      t('Sign in'),
      [...loginForm(), schema.hidden('redirect').default(target)],
      `${panelPath(ctx)}/login`
    )
  }
  async login(ctx: AuthContext) {
    // IP-wide budget counts successful sign-ins too (shared office/NAT IPs); the
    // per-email failure window below stays at 5 and is cleared on success.
    if (await authRateLimited(ctx, 'login', 60)) return authLimitResponse(ctx, 'email')
    const cfg = await config(ctx)
    const Model = await userModel(cfg)
    const input = ctx.request.all()
    let data: { email: string; password: string }
    try {
      data = await loginValidator.validate(input, { messagesProvider: validationMessages(ctx) })
    } catch {
      return flashErrors(ctx, { email: t('Enter a valid email address') })
    }
    const key = createHash('sha256')
      .update(`login:${data.email.toLowerCase()}:${ctx.request.ip()}`)
      .digest('hex')
    if (await consumeLoginLimit(key)) {
      return authLimitResponse(
        ctx,
        'email',
        t('Too many login attempts. Please try again in one minute.')
      )
    }
    let user: LucidRow
    try {
      user = await Model.verifyCredentials(data.email, data.password)
    } catch {
      await recordAuthEvent(ctx, { event: 'failed', method: 'password' })
      return flashErrors(ctx, { email: t('These credentials do not match our records') })
    }
    await clearLoginLimit(key)
    return completeLogin(ctx, ctx.pupitre.panel, user, {
      redirect: safeRedirect(ctx, input.redirect),
      remember: input.remember === true,
    })
  }
  async mfaChallenge(ctx: AuthContext) {
    const pending = ctx.session?.get('pupitre.pendingLogin')
    if (!pending || typeof pending !== 'object' || !('expiresAt' in pending)) {
      return ctx.response.redirect(`${panelPath(ctx)}/login`)
    }
    const expiresAt = pending.expiresAt
    if (typeof expiresAt !== 'number' || expiresAt <= Date.now()) {
      ctx.session?.forget('pupitre.pendingLogin')
      return ctx.response.redirect(`${panelPath(ctx)}/login`)
    }
    return renderAuth(
      ctx,
      t('Multi-factor authentication'),
      [schema.text('code').required().label(t('Authenticator code or recovery code'))],
      `${panelPath(ctx)}/mfa/challenge`
    )
  }
  async completeMfaChallenge(ctx: AuthContext) {
    const cfg = await config(ctx)
    const pending = ctx.session?.get('pupitre.pendingLogin')
    if (
      !pending ||
      typeof pending !== 'object' ||
      !('userId' in pending) ||
      !('guard' in pending)
    ) {
      ctx.session?.forget('pupitre.pendingLogin')
      return ctx.response.redirect(`${panelPath(ctx)}/login`)
    }
    if (
      !('expiresAt' in pending) ||
      typeof pending.expiresAt !== 'number' ||
      pending.expiresAt <= Date.now() ||
      typeof pending.userId !== 'string' ||
      typeof pending.guard !== 'string'
    ) {
      ctx.session?.forget('pupitre.pendingLogin')
      return ctx.response.redirect(`${panelPath(ctx)}/login`)
    }
    const key = createHash('sha256').update(`mfa:${pending.userId}`).digest('hex')
    const limit = await consumeMfaLimit(key)
    if (limit.limited) {
      ctx.session?.forget('pupitre.pendingLogin')
      return ctx.response.redirect(`${panelPath(ctx)}/login`)
    }
    let input: { code?: string; recovery_code?: string }
    try {
      input = await mfaChallengeValidator.validate(ctx.request.all(), {
        messagesProvider: validationMessages(ctx),
      })
    } catch {
      if (limit.exhausted) {
        ctx.session?.forget('pupitre.pendingLogin')
        return ctx.response.redirect(`${panelPath(ctx)}/login`)
      }
      return flashErrors(ctx, { code: t('Enter an authenticator or recovery code') })
    }
    const Model = await userModel(cfg)
    const user = await Model.find(pending.userId)
    if (!user) {
      ctx.session?.forget('pupitre.pendingLogin')
      return ctx.response.redirect(`${panelPath(ctx)}/login`)
    }
    const attributes = user.$attributes as Record<string, unknown>
    const secretAttribute = attributes[cfg.auth.columns.mfaSecret]
    let verified = false
    if (input.code && /^\d{6}$/.test(input.code) && typeof secretAttribute === 'string') {
      const secret = await decryptMfaSecret(secretAttribute)
      verified = await verifyTotp(secret, input.code)
    }
    const recoveryCode = input.recovery_code ?? input.code
    if (!verified && recoveryCode) {
      verified = await consumeRecoveryCode(
        Model,
        pending.userId,
        cfg.auth.columns.mfaRecoveryCodes,
        recoveryCode
      )
    }
    if (!verified) {
      await recordAuthEvent(ctx, { event: 'mfa_failed', userId: pending.userId, method: 'mfa' })
      if (limit.exhausted) {
        ctx.session?.forget('pupitre.pendingLogin')
        return ctx.response.redirect(`${panelPath(ctx)}/login`)
      }
      return flashErrors(ctx, { code: t('The code is invalid or expired') })
    }
    ctx.session?.forget('pupitre.pendingLogin')
    await clearMfaLimit(key)
    return completeLogin(ctx, ctx.pupitre.panel, user, {
      redirect:
        typeof pending.redirect === 'string' ? safeRedirect(ctx, pending.redirect) : panelPath(ctx),
      remember: pending.remember === true,
      mfaSatisfied: true,
      method: typeof pending.method === 'string' ? pending.method : 'password',
    })
  }
  async mfaSetup(ctx: AuthContext) {
    if (await authRateLimited(ctx, 'mfa-setup')) return authLimitResponse(ctx)
    const cfg = await config(ctx)
    const user = ctx.pupitre.authUser as MutableUser
    const attributes = user.$attributes
    if (attributes[cfg.auth.columns.mfaEnabledAt]) {
      return ctx.response.status(409).json({ message: t('MFA is already enabled') })
    }
    const email = String(attributes[cfg.auth.columns.email])
    const enrollment = await createTotpEnrollment(
      ctx.pupitre.panel.auth.mfa?.issuer ?? 'Pupitre',
      email
    )
    ctx.session?.put('pupitre.mfa.setup', {
      secret: enrollment.secret,
      expiresAt: Date.now() + 10 * 60 * 1000,
    })
    return ctx.response.json({ secret: enrollment.secret, qrCode: enrollment.qrCode })
  }
  async mfaConfirm(ctx: AuthContext) {
    if (await authRateLimited(ctx, 'mfa-confirm')) return authLimitResponse(ctx, 'code')
    const cfg = await config(ctx)
    const setup = ctx.session?.get('pupitre.mfa.setup')
    const code = ctx.request.input('code')
    if (
      !setup ||
      typeof setup !== 'object' ||
      !('secret' in setup) ||
      typeof setup.secret !== 'string' ||
      !('expiresAt' in setup) ||
      typeof setup.expiresAt !== 'number' ||
      setup.expiresAt <= Date.now() ||
      typeof code !== 'string' ||
      !(await verifyTotp(setup.secret, code))
    ) {
      return ctx.response
        .status(422)
        .json({ message: t('The authenticator code is invalid or expired') })
    }
    const { codes, hashes } = makeRecoveryCodes()
    const user = ctx.pupitre.authUser as MutableUser
    user.merge({
      [cfg.auth.columns.mfaSecret]: await encryptMfaSecret(setup.secret),
      [cfg.auth.columns.mfaRecoveryCodes]: JSON.stringify(hashes),
      [cfg.auth.columns.mfaEnabledAt]: DateTime.now(),
    })
    await user.save()
    ctx.session?.forget('pupitre.mfa.setup')
    return ctx.response.json({ recoveryCodes: codes })
  }
  async regenerateMfaRecoveryCodes(ctx: AuthContext) {
    const cfg = await config(ctx)
    const user = ctx.pupitre.authUser as MutableUser
    const attributes = user.$attributes
    const key = createHash('sha256').update(`mfa:${user.$primaryKeyValue}`).digest('hex')
    const limit = await consumeMfaLimit(key)
    if (limit.limited)
      return ctx.response.status(429).json({ message: t('Too many attempts. Try again later.') })
    const secretValue = attributes[cfg.auth.columns.mfaSecret]
    const code = ctx.request.input('code')
    if (
      !attributes[cfg.auth.columns.mfaEnabledAt] ||
      typeof secretValue !== 'string' ||
      typeof code !== 'string' ||
      !(await verifyTotp(await decryptMfaSecret(secretValue), code))
    ) {
      return ctx.response.status(422).json({ message: t('The authenticator code is invalid') })
    }
    const { codes, hashes } = makeRecoveryCodes()
    user.merge({ [cfg.auth.columns.mfaRecoveryCodes]: JSON.stringify(hashes) })
    await user.save()
    await clearMfaLimit(key)
    return ctx.response.json({ recoveryCodes: codes })
  }
  async mfaDisable(ctx: AuthContext) {
    const cfg = await config(ctx)
    const user = ctx.pupitre.authUser as MutableUser
    const attributes = user.$attributes
    const key = createHash('sha256').update(`mfa:${user.$primaryKeyValue}`).digest('hex')
    const limit = await consumeMfaLimit(key)
    if (limit.limited)
      return ctx.response.status(429).json({ message: t('Too many attempts. Try again later.') })
    const code = ctx.request.input('code')
    const password = ctx.request.input('current_password')
    let verified = false
    if (typeof password === 'string' && password) {
      try {
        const Model = await userModel(cfg)
        await Model.verifyCredentials(String(attributes[cfg.auth.columns.email]), password)
        verified = true
      } catch {
        verified = false
      }
    } else if (
      typeof code === 'string' &&
      typeof attributes[cfg.auth.columns.mfaSecret] === 'string'
    ) {
      verified = await verifyTotp(
        await decryptMfaSecret(String(attributes[cfg.auth.columns.mfaSecret])),
        code
      )
    }
    if (!verified) {
      return ctx.response
        .status(422)
        .json({ message: t('Current password or authenticator code required') })
    }
    user.merge({
      [cfg.auth.columns.mfaSecret]: null,
      [cfg.auth.columns.mfaRecoveryCodes]: null,
      [cfg.auth.columns.mfaEnabledAt]: null,
    })
    await user.save()
    await clearMfaLimit(key)
    return ctx.response.status(204)
  }
  async passkeyLoginOptions(ctx: AuthContext) {
    if (await authRateLimited(ctx, 'passkey-login-options', 60)) return authLimitResponse(ctx)
    const cfg = await config(ctx)
    return ctx.response.json(await authenticationOptions(ctx, cfg))
  }
  async passkeyLoginVerify(ctx: AuthContext) {
    if (await authRateLimited(ctx, 'passkey-login-verify', 60)) return authLimitResponse(ctx)
    const cfg = await config(ctx)
    const result = await verifyAuthentication(ctx, cfg, ctx.request.input('credential'))
    if (!result) {
      return ctx.response
        .status(422)
        .json({ message: t('The passkey assertion is invalid or expired') })
    }
    const Model = await userModel(cfg)
    const user = await Model.find(result.userId)
    if (!user) {
      return ctx.response.status(422).json({ message: t('The passkey account no longer exists') })
    }
    return completeLogin(ctx, ctx.pupitre.panel, user, {
      redirect: panelPath(ctx),
      mfaSatisfied: result.userVerified,
      method: 'passkey',
    })
  }
  async passkeyRegisterOptions(ctx: AuthContext) {
    if (await authRateLimited(ctx, 'passkey-register-options')) return authLimitResponse(ctx)
    const cfg = await config(ctx)
    const user = ctx.pupitre.authUser as LucidRow & { $attributes: Record<string, unknown> }
    const attributes = user.$attributes
    return ctx.response.json(
      await registrationOptions(ctx, cfg, {
        id: attributes.id as string | number,
        email: String(attributes[cfg.auth.columns.email]),
        name: String(attributes[cfg.auth.columns.name] ?? attributes[cfg.auth.columns.email]),
      })
    )
  }
  async passkeyRegisterVerify(ctx: AuthContext) {
    if (await authRateLimited(ctx, 'passkey-register-verify')) return authLimitResponse(ctx)
    const validated = await passkeyNameValidator.validate(ctx.request.all(), {
      messagesProvider: validationMessages(ctx),
    })
    const result = await verifyRegistration(
      ctx,
      await config(ctx),
      ctx.request.input('credential'),
      validated.name
    )
    if (!result) {
      return ctx.response
        .status(422)
        .json({ message: t('Passkey registration was invalid or expired') })
    }
    return ctx.response.status(201).json(result)
  }
  async listPasskeys(ctx: AuthContext) {
    const user = ctx.pupitre.authUser as LucidRow & { $attributes: Record<string, unknown> }
    return ctx.response.json({
      passkeys: await listPasskeys(ctx, user.$attributes.id as string | number),
    })
  }
  async renamePasskey(ctx: AuthContext) {
    const validated = await passkeyNameValidator.validate(ctx.request.all(), {
      messagesProvider: validationMessages(ctx),
    })
    const user = ctx.pupitre.authUser as LucidRow & { $attributes: Record<string, unknown> }
    const updated = await renamePasskey(
      ctx,
      user.$attributes.id as string | number,
      String(ctx.params.id),
      validated.name
    )
    return updated ? ctx.response.noContent() : ctx.response.notFound()
  }
  async deletePasskey(ctx: AuthContext) {
    const user = ctx.pupitre.authUser as LucidRow & { $attributes: Record<string, unknown> }
    const deleted = await deletePasskey(
      ctx,
      user.$attributes.id as string | number,
      String(ctx.params.id)
    )
    return deleted ? ctx.response.noContent() : ctx.response.notFound()
  }
  async logout(ctx: AuthContext) {
    await revokeCurrentSession(ctx)
    await panelAuth(ctx)
      .use(panelGuard(ctx.pupitre.panel) ?? 'web')
      .logout()
    ctx.session?.forget('pupitre.impersonation')
    ctx.session?.forget(`pupitre.mfaSatisfied.${ctx.pupitre.panel.id}`)
    return ctx.response.redirect(`${panelPath(ctx)}/login`)
  }
  async forgotPage(ctx: AuthContext) {
    await userModel(await config(ctx))
    if (
      await panelAuth(ctx)
        .use(panelGuard(ctx.pupitre.panel) ?? 'web')
        .check()
    )
      return ctx.response.redirect(panelPath(ctx))
    return renderAuth(
      ctx,
      t('Forgot password'),
      [schema.email('email').required().label(t('Email'))],
      `${panelPath(ctx)}/password/email`
    )
  }
  async forgot(ctx: AuthContext) {
    if (await authRateLimited(ctx, 'password-reset-request')) return authLimitResponse(ctx, 'email')
    const cfg = await config(ctx)
    let email: string
    try {
      const validated = await emailValidator.validate(ctx.request.all(), {
        messagesProvider: validationMessages(ctx),
      })
      email = validated.email
    } catch {
      return flashErrors(ctx, { email: t('Enter a valid email address') })
    }
    if (ctx.pupitre.panel.auth.passwordReset && !cfg.mail)
      throw new E_PUPITRE_MAIL_ADAPTER_REQUIRED()
    const key = createHash('sha256')
      .update(`reset:${email.toLowerCase()}:${ctx.request.ip()}`)
      .digest('hex')
    if (await consumeLoginLimit(key)) {
      return authLimitResponse(
        ctx,
        'email',
        t('Too many reset attempts. Please try again in one minute.')
      )
    }
    if (cfg.auth.model && cfg.mail) {
      const Model = await userModel(cfg)
      const user = await Model.findBy(cfg.auth.columns.email, email)
      if (user) {
        const token = randomBytes(32).toString('hex')
        const db = (await app.container.make('lucid.db')) as unknown as ResetDb
        const guard = panelGuard(ctx.pupitre.panel) ?? 'web'
        const id = user.$attributes.id
        await db.from('pupitre_password_resets').where('user_id', id).where('guard', guard).delete()
        await db.table('pupitre_password_resets').insert({
          user_id: id,
          guard,
          token_hash: createHash('sha256').update(token).digest('hex'),
          expires_at: DateTime.now().plus({ minutes: cfg.auth.passwordResetTtl }).toSQL(),
          created_at: DateTime.now().toSQL(),
        })
        const adapter = await resolveAdapter(cfg.mail)
        const url = new URL(
          `${panelPath(ctx)}/password/reset/${token}`,
          ctx.request.completeUrl()
        ).toString()
        const to = String(user.$attributes[cfg.auth.columns.email])
        await adapter?.send(
          resolveTranslations(
            {
              to,
              subject: t('Reset your password'),
              text: t('Reset your password: {url}', { url }),
              html: t('<p>Reset your password: <a href="{url}">Continue</a></p>', { url }),
            },
            ctx.pupitre.locale,
            requestMessages.get(ctx) ?? {}
          )
        )
      }
    }
    ctx.session?.flash('pupitre', [
      { type: 'success', title: t('If that email exists, a reset link has been sent.') },
    ])
    return ctx.response.redirect().back()
  }
  async resetPage(ctx: AuthContext) {
    await userModel(await config(ctx))
    if (
      await panelAuth(ctx)
        .use(panelGuard(ctx.pupitre.panel) ?? 'web')
        .check()
    )
      return ctx.response.redirect(panelPath(ctx))
    const token = String(ctx.params.token)
    return renderAuth(
      ctx,
      t('Reset password'),
      [
        schema.password('password').required().label(t('Password')),
        schema.password('password_confirmation').required().label(t('Confirm password')),
      ],
      `${panelPath(ctx)}/password/reset/${token}`
    )
  }
  async updatePassword(ctx: AuthContext) {
    if (await authRateLimited(ctx, 'password-reset-consume'))
      return authLimitResponse(ctx, 'password')
    const cfg = await config(ctx)
    const Model = await userModel(cfg)
    try {
      const data = await resetValidator.validate(ctx.request.all(), {
        messagesProvider: validationMessages(ctx),
      })
      if (data.password !== data.password_confirmation)
        return flashErrors(ctx, { password_confirmation: t('The passwords do not match') })
      const db = (await app.container.make('lucid.db')) as unknown as ResetDb
      const tokenHash = createHash('sha256').update(String(ctx.params.token)).digest('hex')
      const guard = panelGuard(ctx.pupitre.panel) ?? 'web'
      const reset = await db
        .from('pupitre_password_resets')
        .where('token_hash', tokenHash)
        .where('guard', guard)
        .where('expires_at', '>', DateTime.now().toSQL())
        .first()
      if (!reset) {
        await db.from('pupitre_password_resets').where('token_hash', tokenHash).delete()
        return flashErrors(ctx, { email: t('This password reset link is invalid or expired') })
      }
      const user = (await Model.findBy('id', reset.user_id)) as MutableUser | null
      if (!user)
        return flashErrors(ctx, { email: t('This password reset link is invalid or expired') })
      user.merge({ [cfg.auth.columns.password]: data.password })
      await user.save()
      await db.from('pupitre_password_resets').where('token_hash', tokenHash).delete()
      return ctx.response.redirect(`${panelPath(ctx)}/login`)
    } catch {
      return flashErrors(ctx, { password: t('Enter a valid password') })
    }
  }
  async registerPage(ctx: AuthContext) {
    await userModel(await config(ctx))
    if (
      await panelAuth(ctx)
        .use(panelGuard(ctx.pupitre.panel) ?? 'web')
        .check()
    )
      return ctx.response.redirect(panelPath(ctx))
    return renderAuth(
      ctx,
      t('Create account'),
      [
        schema.text('name').required().label(t('Name')),
        schema.email('email').required().label(t('Email')),
        schema.password('password').required().label(t('Password')),
      ],
      `${panelPath(ctx)}/register`
    )
  }
  async register(ctx: AuthContext) {
    if (await authRateLimited(ctx, 'register')) return authLimitResponse(ctx, 'email')
    const cfg = await config(ctx)
    const Model = await userModel(cfg)
    if (ctx.pupitre.panel.auth.emailVerification && !cfg.mail)
      throw new E_PUPITRE_MAIL_ADAPTER_REQUIRED()
    try {
      const data = await registrationValidator.validate(ctx.request.all(), {
        messagesProvider: validationMessages(ctx),
      })
      const user = await Model.create({
        [cfg.auth.columns.name]: data.name,
        [cfg.auth.columns.email]: data.email,
        [cfg.auth.columns.password]: data.password,
      })
      if (ctx.pupitre.panel.auth.emailVerification) await sendVerification(ctx, user, cfg)
      return completeLogin(ctx, ctx.pupitre.panel, user, {
        redirect: ctx.pupitre.panel.auth.emailVerification
          ? `${panelPath(ctx)}/email/verify`
          : panelPath(ctx),
      })
    } catch {
      return flashErrors(ctx, { email: t('Unable to create an account with those details') })
    }
  }
  async verificationNotice(ctx: AuthContext) {
    const cfg = await config(ctx)
    await userModel(cfg)
    const verified = (ctx.pupitre.authUser as LucidRow & { $attributes: Record<string, unknown> })
      .$attributes[cfg.auth.columns.emailVerifiedAt]
    if (verified) return ctx.response.redirect(panelPath(ctx))
    return renderAuth(
      ctx,
      t('Verify your email address'),
      [schema.hidden('verification').default('resend')],
      `${panelPath(ctx)}/email/verification-notification`
    )
  }
  async sendVerification(ctx: AuthContext) {
    if (await authRateLimited(ctx, 'email-resend')) return authLimitResponse(ctx)
    const cfg = await config(ctx)
    if (ctx.pupitre.authUser) await sendVerification(ctx, ctx.pupitre.authUser, cfg)
    return ctx.response.redirect().back()
  }
  async verifyEmail(ctx: AuthContext) {
    const cfg = await config(ctx)
    const Model = await userModel(cfg)
    if (!ctx.request.hasValidSignature('pupitre-email-verification')) {
      throw new E_PUPITRE_FORBIDDEN()
    }
    const user = (await Model.findBy('id', ctx.params.id)) as MutableUser | null
    if (!user) return ctx.response.notFound()
    const email = String(user.$attributes[cfg.auth.columns.email])
    const expectedHash = createHash('sha1').update(email).digest('hex')
    if (expectedHash !== ctx.params.hash) throw new E_PUPITRE_FORBIDDEN()
    user.merge({ [cfg.auth.columns.emailVerifiedAt]: DateTime.now() })
    await user.save()
    return ctx.response.redirect(`${panelPath(ctx)}/login`)
  }
  async profile(ctx: AuthContext) {
    const cfg = await config(ctx)
    const user = ctx.pupitre.authUser as MutableUser | null
    if (!user) throw new E_PUPITRE_FORBIDDEN()
    const locales = ctx.pupitre.panel.locales ?? [ctx.pupitre.panel.locale ?? 'en']
    const nodes: AuthSchemaInput[] = [
      schema.text('name').required().label(t('Name')),
      schema.email('email').required().label(t('Email')),
      schema.password('current_password').label(t('Current password')),
      schema.password('password').label(t('New password')),
      schema.password('password_confirmation').label(t('Confirm new password')),
    ]
    if (locales.length > 1) {
      nodes.push(
        schema
          .select('locale')
          .required()
          .label(t('Language'))
          .options(
            locales.map((locale) => ({
              value: locale,
              label: new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale,
            }))
          )
      )
    }
    const numberLocales = numberLocaleChoices(ctx.pupitre.panel)
    if (numberLocales.length > 0) {
      nodes.push(
        schema
          .select('numberLocale')
          .required()
          .label(t('Number format'))
          .options(
            numberLocaleOptions(
              ctx.pupitre.locale,
              ctx.pupitre.panel.numberLocale ?? ctx.pupitre.locale,
              numberLocales
            )
          )
      )
    }
    if (ctx.pupitre.panel.auth.mfa || ctx.pupitre.panel.auth.passkeys?.enabled) {
      nodes.push(
        schema.view('PupitreProfileSecurity', {
          basePath: panelPath(ctx),
          mfaEnabled: Boolean(user.$attributes[cfg.auth.columns.mfaEnabledAt]),
          passkeysEnabled: ctx.pupitre.panel.auth.passkeys?.enabled === true,
        })
      )
    }
    if (ctx.pupitre.panel.sessions && !ctx.session.get('pupitre.impersonation')) {
      nodes.push(
        schema.view('PupitreProfileSessions', {
          basePath: panelPath(ctx),
          hasPassword: Boolean(user.$attributes[cfg.auth.columns.password]),
          passkeysEnabled: ctx.pupitre.panel.auth.passkeys?.enabled === true,
          history: ctx.pupitre.panel.sessions.history,
        })
      )
    }
    if (ctx.pupitre.panel.auth.profile?.avatar)
      nodes.push(schema.fileUpload('avatar').image().maxSize('5mb').label(t('Avatar')))
    return renderAuth(
      ctx,
      t('Profile'),
      nodes,
      `${panelPath(ctx)}/profile`,
      'put',
      'page',
      {
        name: user.$attributes[cfg.auth.columns.name],
        email: user.$attributes[cfg.auth.columns.email],
        ...(locales.length > 1 ? { locale: ctx.pupitre.locale } : {}),
        ...(numberLocales.length > 0
          ? {
              numberLocale: numberLocales.includes(ctx.pupitre.numberLocale)
                ? ctx.pupitre.numberLocale
                : AUTO_NUMBER_LOCALE,
            }
          : {}),
      },
      {
        upload: `${panelPath(ctx)}/profile/avatar`,
        delete: `${panelPath(ctx)}/profile/avatar`,
      }
    )
  }
  async uploadAvatar(ctx: AuthContext) {
    const user = ctx.pupitre.authUser as MutableUser
    if (
      !ctx.pupitre.panel.auth.profile?.avatar ||
      ctx.request.input('resource') !== 'profile' ||
      ctx.request.input('field') !== 'avatar' ||
      String(ctx.request.input('record')) !== String(user.$attributes.id)
    )
      return ctx.response.status(422).json({ message: t('Invalid profile avatar upload') })

    const file = ctx.request.file('file') as MultipartFile | null
    if (!file || !file.tmpPath || file.errors.length > 0 || file.size > 5 * 1024 * 1024)
      return ctx.response.status(422).json({ message: t('Choose an image no larger than 5 MB') })
    const bytes = await readUploadBytes(file.tmpPath, 5 * 1024 * 1024)
    const type = await fileTypeFromBuffer(bytes)
    if (!type || !isPassiveImageMime(type.mime))
      return ctx.response.status(422).json({ message: t('The avatar must be an image') })

    const key = `avatars/${String(user.$attributes.id)}/${randomUUID()}.${type.ext}`
    const storage = createPupitreStorage()
    await storage.put(key, bytes, { contentType: type.mime, visibility: 'public' })
    const uploads = profileAvatarUploads(ctx)
    uploads.push({ key, userId: String(user.$attributes.id) })
    ctx.session?.put('pupitre.profileAvatarUploads', uploads)
    return ctx.response.ok({
      key,
      url: await storage.url(key, { visibility: 'public' }),
      name: file.clientName,
      size: bytes.byteLength,
      mime: type.mime,
    })
  }

  async deleteAvatar(ctx: AuthContext) {
    const user = ctx.pupitre.authUser as MutableUser
    const key = ctx.request.input('key')
    const userId = String(user.$attributes.id)
    const uploads = profileAvatarUploads(ctx)
    if (
      typeof key !== 'string' ||
      !uploads.some((upload) => upload.key === key && upload.userId === userId)
    )
      return ctx.response
        .status(403)
        .json({ message: t('This upload is not owned by the current session') })
    ctx.session?.put(
      'pupitre.profileAvatarUploads',
      uploads.filter((upload) => upload.key !== key)
    )
    await createPupitreStorage().delete(key)
    return ctx.response.noContent()
  }
  async updateProfile(ctx: AuthContext) {
    const cfg = await config(ctx)
    const user = ctx.pupitre.authUser as MutableUser
    const input = ctx.request.all()
    const locale = input.locale
    const locales = ctx.pupitre.panel.locales ?? [ctx.pupitre.panel.locale ?? 'en']
    if (
      locale !== undefined &&
      (typeof locale !== 'string' || locales.length <= 1 || !locales.includes(locale))
    )
      return flashErrors(ctx, { locale: t('Choose a valid language') })
    const numberLocale = input.numberLocale
    if (
      numberLocale !== undefined &&
      (typeof numberLocale !== 'string' ||
        (numberLocale !== AUTO_NUMBER_LOCALE &&
          !numberLocaleChoices(ctx.pupitre.panel).includes(numberLocale)))
    )
      return flashErrors(ctx, { numberLocale: t('Choose a valid number format') })
    for (const field of ['password', 'password_confirmation', 'current_password']) {
      if (input[field] === '') delete input[field]
    }
    let validated: {
      name?: string
      email?: string
      password?: string
      password_confirmation?: string
      current_password?: string
    }
    try {
      validated = await profileValidator.validate(input, {
        messagesProvider: validationMessages(ctx),
      })
    } catch {
      return flashErrors(ctx, { email: t('Enter valid profile details') })
    }
    const emailChanged =
      validated.email !== undefined && validated.email !== user.$attributes[cfg.auth.columns.email]
    const passwordChanged = Boolean(validated.password)
    if (passwordChanged && validated.password !== validated.password_confirmation)
      return flashErrors(ctx, { password_confirmation: t('The passwords do not match') })
    if (emailChanged && validated.email) {
      const Model = await userModel(cfg)
      const existing = await Model.findBy(cfg.auth.columns.email, validated.email)
      if (existing && String(existing.$attributes.id) !== String(user.$attributes.id))
        return flashErrors(ctx, { email: t('This email address is already in use') })
    }
    if (emailChanged || passwordChanged) {
      if (typeof validated.current_password !== 'string')
        return flashErrors(ctx, { current_password: t('Current password is required') })
      try {
        const Model = await userModel(cfg)
        await Model.verifyCredentials(
          String(user.$attributes[cfg.auth.columns.email]),
          validated.current_password
        )
      } catch {
        return flashErrors(ctx, { current_password: t('The current password is incorrect') })
      }
    }
    const changes: Record<string, unknown> = {}
    if (validated.name) changes[cfg.auth.columns.name] = validated.name
    if (validated.email) changes[cfg.auth.columns.email] = validated.email
    if (emailChanged && ctx.pupitre.panel.auth.emailVerification)
      changes[cfg.auth.columns.emailVerifiedAt] = null
    if (passwordChanged) changes[cfg.auth.columns.password] = validated.password
    let storedAvatar: string | undefined
    if (ctx.pupitre.panel.auth.profile?.avatar) {
      const file = ctx.request.file('avatar') as MultipartFile | null
      if (file) {
        if (!file.tmpPath || file.errors.length > 0 || file.size > 5 * 1024 * 1024)
          return flashErrors(ctx, { avatar: t('Choose an image no larger than 5 MB') })
        const bytes = await readUploadBytes(file.tmpPath, 5 * 1024 * 1024)
        const type = await fileTypeFromBuffer(bytes)
        if (!type || !isPassiveImageMime(type.mime))
          return flashErrors(ctx, { avatar: t('The avatar must be an image') })
        storedAvatar = `avatars/${String(user.$attributes.id)}/${randomUUID()}.${type.ext}`
        await createPupitreStorage().put(storedAvatar, bytes, {
          contentType: type.mime,
          visibility: 'public',
        })
        changes[cfg.auth.columns.avatar] = storedAvatar
      } else if (typeof input.avatar === 'string' && input.avatar) {
        const userId = String(user.$attributes.id)
        const ownsUpload = profileAvatarUploads(ctx).some(
          (upload) => upload.key === input.avatar && upload.userId === userId
        )
        if (!ownsUpload)
          return flashErrors(ctx, { avatar: t('Upload a new avatar before saving the profile') })
        storedAvatar = input.avatar
        changes[cfg.auth.columns.avatar] = storedAvatar
      }
    }
    const oldAvatar = user.$attributes[cfg.auth.columns.avatar]
    try {
      user.merge(changes)
      await user.save()
    } catch (error) {
      if (storedAvatar && !profileAvatarUploads(ctx).some((upload) => upload.key === storedAvatar))
        await createPupitreStorage().delete(storedAvatar)
      throw error
    }
    if (storedAvatar) {
      ctx.session?.put(
        'pupitre.profileAvatarUploads',
        profileAvatarUploads(ctx).filter((upload) => upload.key !== storedAvatar)
      )
      if (typeof oldAvatar === 'string' && oldAvatar !== storedAvatar)
        await createPupitreStorage().delete(oldAvatar)
    }
    if (typeof locale === 'string') await persistLocale(ctx, locale)
    if (typeof numberLocale === 'string')
      await persistNumberLocale(ctx, numberLocale === AUTO_NUMBER_LOCALE ? null : numberLocale)
    if (emailChanged && ctx.pupitre.panel.auth.emailVerification)
      await sendVerification(ctx, user, cfg)
    ctx.session?.flash('pupitre', [{ type: 'success', title: t('Profile updated') }])
    return ctx.response.redirect(`${panelPath(ctx)}/profile`)
  }
}
