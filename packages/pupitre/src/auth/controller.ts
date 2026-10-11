import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
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
import { consumeLoginLimit } from '../drivers/limiter.js'
import { panelGuard } from './guard.js'
import { E_PUPITRE_FORBIDDEN, E_PUPITRE_MAIL_ADAPTER_REQUIRED } from '../errors.js'
import { t } from '../i18n.js'

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
    schema.email('email').required().label('Email'),
    schema.password('password').required().label('Password'),
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
  'Forgot password': 'Send reset link',
  'Verify your email address': 'Resend verification email',
  'Profile': 'Save',
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
    form: formDescriptor(action, t(submitLabels[title] ?? title), method),
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
  await adapter?.send({
    to: email,
    subject: 'Verify your email address',
    text: `Verify your email address: ${url}`,
    html: `<p>Verify your email address: <a href="${url}">Continue</a></p>`,
  })
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
      'Sign in',
      [...loginForm(), schema.hidden('redirect').default(target)],
      `${panelPath(ctx)}/login`
    )
  }
  async login(ctx: AuthContext) {
    const cfg = await config(ctx)
    const Model = await userModel(cfg)
    const input = ctx.request.all()
    let data: { email: string; password: string }
    try {
      data = await loginValidator.validate(input)
    } catch {
      return flashErrors(ctx, { email: 'Enter a valid email address' })
    }
    const key = createHash('sha256')
      .update(`login:${data.email.toLowerCase()}:${ctx.request.ip()}`)
      .digest('hex')
    if (await consumeLoginLimit(key)) {
      ctx.session?.flash('inputErrorsBag', {
        email: 'Too many login attempts. Please try again in one minute.',
      })
      return ctx.response.status(429).redirect().back()
    }
    try {
      const user = await Model.verifyCredentials(data.email, data.password)
      await panelAuth(ctx)
        .use(panelGuard(ctx.pupitre.panel) ?? 'web')
        .login(user)
      return ctx.response.redirect(safeRedirect(ctx, input.redirect))
    } catch {
      return flashErrors(ctx, { email: 'These credentials do not match our records' })
    }
  }
  async logout(ctx: AuthContext) {
    await panelAuth(ctx)
      .use(panelGuard(ctx.pupitre.panel) ?? 'web')
      .logout()
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
      'Forgot password',
      [schema.email('email').required().label('Email')],
      `${panelPath(ctx)}/password/email`
    )
  }
  async forgot(ctx: AuthContext) {
    const cfg = await config(ctx)
    let email: string
    try {
      const validated = await emailValidator.validate(ctx.request.all())
      email = validated.email
    } catch {
      return flashErrors(ctx, { email: 'Enter a valid email address' })
    }
    if (ctx.pupitre.panel.auth.passwordReset && !cfg.mail)
      throw new E_PUPITRE_MAIL_ADAPTER_REQUIRED()
    const key = createHash('sha256')
      .update(`reset:${email.toLowerCase()}:${ctx.request.ip()}`)
      .digest('hex')
    if (await consumeLoginLimit(key)) {
      ctx.session?.flash('inputErrorsBag', {
        email: 'Too many reset attempts. Please try again in one minute.',
      })
      return ctx.response.status(429).redirect().back()
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
        await adapter?.send({
          to,
          subject: 'Reset your password',
          text: `Reset your password: ${url}`,
          html: `<p>Reset your password: <a href="${url}">Continue</a></p>`,
        })
      }
    }
    ctx.session?.flash('pupitre', [
      { type: 'success', title: 'If that email exists, a reset link has been sent.' },
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
      'Reset password',
      [
        schema.password('password').required().label('Password'),
        schema.password('password_confirmation').required().label('Confirm password'),
      ],
      `${panelPath(ctx)}/password/reset/${token}`
    )
  }
  async updatePassword(ctx: AuthContext) {
    const cfg = await config(ctx)
    const Model = await userModel(cfg)
    try {
      const data = await resetValidator.validate(ctx.request.all())
      if (data.password !== data.password_confirmation)
        return flashErrors(ctx, { password_confirmation: 'The passwords do not match' })
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
        return flashErrors(ctx, { email: 'This password reset link is invalid or expired' })
      }
      const user = (await Model.findBy('id', reset.user_id)) as MutableUser | null
      if (!user)
        return flashErrors(ctx, { email: 'This password reset link is invalid or expired' })
      user.merge({ [cfg.auth.columns.password]: data.password })
      await user.save()
      await db.from('pupitre_password_resets').where('token_hash', tokenHash).delete()
      return ctx.response.redirect(`${panelPath(ctx)}/login`)
    } catch {
      return flashErrors(ctx, { password: 'Enter a valid password' })
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
      'Create account',
      [
        schema.text('name').required().label('Name'),
        schema.email('email').required().label('Email'),
        schema.password('password').required().label('Password'),
      ],
      `${panelPath(ctx)}/register`
    )
  }
  async register(ctx: AuthContext) {
    const cfg = await config(ctx)
    const Model = await userModel(cfg)
    if (ctx.pupitre.panel.auth.emailVerification && !cfg.mail)
      throw new E_PUPITRE_MAIL_ADAPTER_REQUIRED()
    try {
      const data = await registrationValidator.validate(ctx.request.all())
      const user = await Model.create({
        [cfg.auth.columns.name]: data.name,
        [cfg.auth.columns.email]: data.email,
        [cfg.auth.columns.password]: data.password,
      })
      await panelAuth(ctx)
        .use(panelGuard(ctx.pupitre.panel) ?? 'web')
        .login(user)
      if (ctx.pupitre.panel.auth.emailVerification) await sendVerification(ctx, user, cfg)
      return ctx.response.redirect(
        ctx.pupitre.panel.auth.emailVerification ? `${panelPath(ctx)}/email/verify` : panelPath(ctx)
      )
    } catch {
      return flashErrors(ctx, { email: 'Unable to create an account with those details' })
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
      'Verify your email address',
      [schema.hidden('verification').default('resend')],
      `${panelPath(ctx)}/email/verification-notification`
    )
  }
  async sendVerification(ctx: AuthContext) {
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
    const nodes: AuthSchemaInput[] = [
      schema.text('name').required().label('Name'),
      schema.email('email').required().label('Email'),
      schema.password('current_password').label('Current password'),
      schema.password('password').label('New password'),
      schema.password('password_confirmation').label('Confirm new password'),
    ]
    if (ctx.pupitre.panel.auth.profile.avatar)
      nodes.push(schema.fileUpload('avatar').image().maxSize('5mb').label('Avatar'))
    return renderAuth(
      ctx,
      'Profile',
      nodes,
      `${panelPath(ctx)}/profile`,
      'put',
      'page',
      {
        name: user.$attributes[cfg.auth.columns.name],
        email: user.$attributes[cfg.auth.columns.email],
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
      !ctx.pupitre.panel.auth.profile.avatar ||
      ctx.request.input('resource') !== 'profile' ||
      ctx.request.input('field') !== 'avatar' ||
      String(ctx.request.input('record')) !== String(user.$attributes.id)
    )
      return ctx.response.status(422).json({ message: 'Invalid profile avatar upload' })

    const file = ctx.request.file('file') as MultipartFile | null
    if (!file || !file.tmpPath || file.errors.length > 0 || file.size > 5 * 1024 * 1024)
      return ctx.response.status(422).json({ message: 'Choose an image no larger than 5 MB' })
    const bytes = await readFile(file.tmpPath)
    if (bytes.byteLength > 5 * 1024 * 1024)
      return ctx.response.status(422).json({ message: 'Choose an image no larger than 5 MB' })
    const type = await fileTypeFromBuffer(bytes)
    if (!type?.mime.startsWith('image/'))
      return ctx.response.status(422).json({ message: 'The avatar must be an image' })

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
        .json({ message: 'This upload is not owned by the current session' })
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
      validated = await profileValidator.validate(input)
    } catch {
      return flashErrors(ctx, { email: 'Enter valid profile details' })
    }
    const emailChanged =
      validated.email !== undefined && validated.email !== user.$attributes[cfg.auth.columns.email]
    const passwordChanged = Boolean(validated.password)
    if (passwordChanged && validated.password !== validated.password_confirmation)
      return flashErrors(ctx, { password_confirmation: 'The passwords do not match' })
    if (emailChanged && validated.email) {
      const Model = await userModel(cfg)
      const existing = await Model.findBy(cfg.auth.columns.email, validated.email)
      if (existing && String(existing.$attributes.id) !== String(user.$attributes.id))
        return flashErrors(ctx, { email: 'This email address is already in use' })
    }
    if (emailChanged || passwordChanged) {
      if (typeof validated.current_password !== 'string')
        return flashErrors(ctx, { current_password: 'Current password is required' })
      try {
        const Model = await userModel(cfg)
        await Model.verifyCredentials(
          String(user.$attributes[cfg.auth.columns.email]),
          validated.current_password
        )
      } catch {
        return flashErrors(ctx, { current_password: 'The current password is incorrect' })
      }
    }
    const changes: Record<string, unknown> = {}
    if (validated.name) changes[cfg.auth.columns.name] = validated.name
    if (validated.email) changes[cfg.auth.columns.email] = validated.email
    if (emailChanged && ctx.pupitre.panel.auth.emailVerification)
      changes[cfg.auth.columns.emailVerifiedAt] = null
    if (passwordChanged) changes[cfg.auth.columns.password] = validated.password
    let storedAvatar: string | undefined
    if (ctx.pupitre.panel.auth.profile.avatar) {
      const file = ctx.request.file('avatar') as MultipartFile | null
      if (file) {
        if (!file.tmpPath || file.errors.length > 0 || file.size > 5 * 1024 * 1024)
          return flashErrors(ctx, { avatar: 'Choose an image no larger than 5 MB' })
        const bytes = await readFile(file.tmpPath)
        if (bytes.byteLength > 5 * 1024 * 1024)
          return flashErrors(ctx, { avatar: 'Choose an image no larger than 5 MB' })
        const type = await fileTypeFromBuffer(bytes)
        if (!type?.mime.startsWith('image/'))
          return flashErrors(ctx, { avatar: 'The avatar must be an image' })
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
          return flashErrors(ctx, { avatar: 'Upload a new avatar before saving the profile' })
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
    if (emailChanged && ctx.pupitre.panel.auth.emailVerification)
      await sendVerification(ctx, user, cfg)
    ctx.session?.flash('pupitre', [{ type: 'success', title: 'Profile updated' }])
    return ctx.response.redirect(`${panelPath(ctx)}/profile`)
  }
}
