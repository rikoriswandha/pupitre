import type * as WebAuthn from '@simplewebauthn/server'
import type { HttpContext } from '@adonisjs/core/http'
import type { PupitreConfig } from '../define_config.js'

import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  WebAuthnCredential,
} from '@simplewebauthn/server'

export type PasskeyRow = {
  id: string | number
  user_id: string | number
  credential_id: string
  public_key: string
  counter: number | string
  transports: string[] | string
  device_type: string
  backed_up: boolean | number
  name: string | null
  created_at: string
  updated_at: string
  last_used_at: string | null
}

type Query = PromiseLike<PasskeyRow[]> & {
  where(key: string, value: unknown): Query
  select(...columns: string[]): Query
  first(): Promise<PasskeyRow | undefined>
  insert(row: Record<string, unknown>): Promise<unknown>
  update(row: Record<string, unknown>): Promise<unknown>
  delete(): Promise<unknown>
}
type Db = { from(table: string): Query; table(table: string): Query }
type AuthChallenge = { challenge: string; expiresAt: number; userId?: string }

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isRegistrationResponse(value: unknown): value is RegistrationResponseJSON {
  return (
    object(value) &&
    typeof value.id === 'string' &&
    typeof value.rawId === 'string' &&
    value.type === 'public-key' &&
    object(value.response) &&
    typeof value.response.clientDataJSON === 'string' &&
    typeof value.response.attestationObject === 'string' &&
    object(value.clientExtensionResults)
  )
}

function isAuthenticationResponse(value: unknown): value is AuthenticationResponseJSON {
  return (
    object(value) &&
    typeof value.id === 'string' &&
    typeof value.rawId === 'string' &&
    value.type === 'public-key' &&
    object(value.response) &&
    typeof value.response.clientDataJSON === 'string' &&
    typeof value.response.authenticatorData === 'string' &&
    typeof value.response.signature === 'string' &&
    object(value.clientExtensionResults)
  )
}

type WebAuthnLoader = () => Promise<typeof WebAuthn>

let loadWebAuthn: WebAuthnLoader = () => import('@simplewebauthn/server')

/** Replaces the lazy peer loader in integration tests without touching Node's module cache. */
export function setWebAuthnLoaderForTests(loader?: WebAuthnLoader) {
  loadWebAuthn = loader ?? (() => import('@simplewebauthn/server'))
}

async function webauthn() {
  try {
    // WebAuthn is an optional peer; load only when a passkey endpoint is used.
    return await loadWebAuthn()
  } catch (error) {
    throw new Error(
      'E_PUPITRE_MISSING_PEER: passkeys require the optional "@simplewebauthn/server" dependency',
      { cause: error }
    )
  }
}

async function database(ctx: HttpContext): Promise<Db> {
  return (await ctx.containerResolver.make('lucid.db')) as Db
}

function relyingParty(ctx: HttpContext, cfg: PupitreConfig) {
  const url = new URL(ctx.request.completeUrl())
  return {
    id: cfg.auth.passkeys?.rpId ?? url.hostname,
    origin: cfg.auth.passkeys?.origin ?? url.origin,
    name: cfg.auth.passkeys?.rpName ?? 'Pupitre',
  }
}

function readChallenge(ctx: HttpContext, key: string): AuthChallenge | null {
  const value = ctx.session?.get(key)
  if (
    !object(value) ||
    typeof value.challenge !== 'string' ||
    typeof value.expiresAt !== 'number'
  ) {
    return null
  }
  if (value.expiresAt <= Date.now()) return null
  return {
    challenge: value.challenge,
    expiresAt: value.expiresAt,
    ...(typeof value.userId === 'string' ? { userId: value.userId } : {}),
  }
}

export async function registrationOptions(
  ctx: HttpContext,
  cfg: PupitreConfig,
  user: { id: string | number; email: string; name: string }
) {
  const api = await webauthn()
  const db = await database(ctx)
  const rows = await db
    .from('pupitre_passkeys')
    .where('user_id', user.id)
    .select('credential_id', 'transports')
  const rp = relyingParty(ctx, cfg)
  const options = await api.generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    userID: Buffer.from(String(user.id)),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    excludeCredentials: rows.map((row) => ({
      id: row.credential_id,
      transports: Array.isArray(row.transports) ? row.transports : [],
    })),
  })
  ctx.session?.put('pupitre.passkeys.register', {
    challenge: options.challenge,
    userId: String(user.id),
    expiresAt: Date.now() + 5 * 60 * 1000,
  })
  return options
}

export async function verifyRegistration(
  ctx: HttpContext,
  cfg: PupitreConfig,
  response: unknown,
  name: string
) {
  const pending = readChallenge(ctx, 'pupitre.passkeys.register')
  if (!pending?.userId || !isRegistrationResponse(response)) {
    ctx.session?.forget('pupitre.passkeys.register')
    return null
  }
  ctx.session?.forget('pupitre.passkeys.register')
  const api = await webauthn()
  const rp = relyingParty(ctx, cfg)
  const result = await api.verifyRegistrationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.id,
    requireUserVerification: false,
  })
  if (!result.verified || !result.registrationInfo) return null
  const credential = result.registrationInfo.credential
  const db = await database(ctx)
  await db.table('pupitre_passkeys').insert({
    user_id: pending.userId,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: JSON.stringify(credential.transports ?? []),
    device_type: result.registrationInfo.credentialDeviceType,
    backed_up: result.registrationInfo.credentialBackedUp,
    name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_used_at: null,
  })
  return { credentialId: credential.id }
}

export async function authenticationOptions(ctx: HttpContext, cfg: PupitreConfig) {
  const api = await webauthn()
  const rp = relyingParty(ctx, cfg)
  const options = await api.generateAuthenticationOptions({
    rpID: rp.id,
    userVerification: 'preferred',
  })
  ctx.session?.put('pupitre.passkeys.authenticate', {
    challenge: options.challenge,
    expiresAt: Date.now() + 5 * 60 * 1000,
  })
  return options
}

export async function verifyAuthentication(
  ctx: HttpContext,
  cfg: PupitreConfig,
  response: unknown
) {
  const pending = readChallenge(ctx, 'pupitre.passkeys.authenticate')
  if (!pending || !isAuthenticationResponse(response)) {
    ctx.session?.forget('pupitre.passkeys.authenticate')
    return null
  }
  ctx.session?.forget('pupitre.passkeys.authenticate')
  const db = await database(ctx)
  const row = await db.from('pupitre_passkeys').where('credential_id', response.id).first()
  if (!row) return null
  const transports =
    typeof row.transports === 'string' ? JSON.parse(row.transports) : row.transports
  const credential: WebAuthnCredential = {
    id: row.credential_id,
    publicKey: Buffer.from(row.public_key, 'base64url'),
    counter: Number(row.counter),
    transports: Array.isArray(transports) ? transports : [],
  }
  const api = await webauthn()
  const rp = relyingParty(ctx, cfg)
  const result = await api.verifyAuthenticationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.id,
    credential,
    requireUserVerification: false,
  })
  if (!result.verified) return null
  await db.from('pupitre_passkeys').where('id', row.id).update({
    counter: result.authenticationInfo.newCounter,
    backed_up: result.authenticationInfo.credentialBackedUp,
    device_type: result.authenticationInfo.credentialDeviceType,
    last_used_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  return { userId: String(row.user_id), userVerified: result.authenticationInfo.userVerified }
}

export async function listPasskeys(ctx: HttpContext, userId: string | number) {
  const db = await database(ctx)
  return await db
    .from('pupitre_passkeys')
    .where('user_id', userId)
    .select('id', 'name', 'created_at', 'last_used_at')
}

export async function renamePasskey(
  ctx: HttpContext,
  userId: string | number,
  id: string,
  name: string
) {
  const db = await database(ctx)
  const query = db.from('pupitre_passkeys').where('id', id).where('user_id', userId)
  const row = await query.first()
  if (!row) return false
  await query.update({ name, updated_at: new Date().toISOString() })
  return true
}

export async function deletePasskey(ctx: HttpContext, userId: string | number, id: string) {
  const db = await database(ctx)
  // Separate builders: `first()` adds `limit 1`, which Lucid rejects on `delete`.
  const row = await db.from('pupitre_passkeys').where('id', id).where('user_id', userId).first()
  if (!row) return false
  await db.from('pupitre_passkeys').where('id', id).where('user_id', userId).delete()
  return true
}
