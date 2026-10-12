import { DateTime } from 'luxon'
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { defineConfig as defineEncryptionConfig, drivers } from '@adonisjs/core/encryption'
import { generate, verify } from 'otplib'
import { test } from '@japa/runner'
import { definePanel } from '../../../index.js'
import {
  authenticationOptions,
  setWebAuthnLoaderForTests,
} from '../../../src/auth/passkey_service.js'
import { closeTestApp, createTestApp, User } from '../../helpers/app.js'

const panel = definePanel('admin')
  .path('/admin')
  .login()
  .profile()
  .mfa({ required: true })
  .passkeys()
function options(authPanel = panel) {
  return {
    panels: { [authPanel.toDefinition().id]: async () => ({ default: authPanel }) },
    pupitre: { auth: { model: async () => ({ default: User }), columns: { name: 'name' } } },
    config: {
      encryption: defineEncryptionConfig({
        default: 'gcm',
        list: { gcm: drivers.aes256gcm({ keys: ['01234567890123456789012345678901'], id: 'gcm' }) },
      }),
    },
  }
}
function cookies(response: Response, previous = '') {
  const parts = new Map(
    previous
      .split('; ')
      .filter(Boolean)
      .map((pair) => [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)])
  )
  for (const item of response.headers.getSetCookie()) {
    const pair = item.split(';', 1)[0]!
    const split = pair.indexOf('=')
    if (split > 0) parts.set(pair.slice(0, split), pair.slice(split + 1))
  }
  return [...parts].map(([key, value]) => `${key}=${value}`).join('; ')
}
async function login(
  baseUrl: string,
  cookie: string,
  email: string,
  password: string,
  path = '/admin'
) {
  const response = await fetch(`${baseUrl}${path}/login`, {
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html',
    },
    body: new URLSearchParams({ email, password }),
    redirect: 'manual',
  })
  return { response, cookie: cookies(response, cookie) }
}
async function post(
  baseUrl: string,
  cookie: { value: string },
  route: string,
  body?: Record<string, unknown>,
  path = '/admin'
) {
  const response = await fetch(`${baseUrl}${path}${route}`, {
    method: 'POST',
    headers: {
      Cookie: cookie.value,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'manual',
  })
  cookie.value = cookies(response, cookie.value)
  return response
}
function cborHead(major: number, value: number) {
  if (value < 24) return Buffer.from([(major << 5) | value])
  if (value <= 0xff) return Buffer.from([(major << 5) | 24, value])
  if (value <= 0xffff) {
    const output = Buffer.alloc(3)
    output[0] = (major << 5) | 25
    output.writeUInt16BE(value, 1)
    return output
  }
  const output = Buffer.alloc(5)
  output[0] = (major << 5) | 26
  output.writeUInt32BE(value, 1)
  return output
}

function cbor(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return Buffer.concat([cborHead(2, value.length), value])
  if (typeof value === 'string') {
    const bytes = Buffer.from(value)
    return Buffer.concat([cborHead(3, bytes.length), bytes])
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value)
  }
  if (value instanceof Map) {
    const entries = [...value.entries()]
    return Buffer.concat([
      cborHead(5, entries.length),
      ...entries.flatMap(([key, item]) => [cbor(key), cbor(item)]),
    ])
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
    return Buffer.concat([
      cborHead(5, entries.length),
      ...entries.flatMap(([key, item]) => [cbor(key), cbor(item)]),
    ])
  }
  throw new Error(`Unsupported CBOR value: ${String(value)}`)
}

function webAuthnData(rpId: string, flags: number, counter: number) {
  const data = Buffer.alloc(37)
  createHash('sha256').update(rpId).digest().copy(data, 0)
  data[32] = flags
  data.writeUInt32BE(counter, 33)
  return data
}

function clientData(type: 'webauthn.create' | 'webauthn.get', challenge: string, origin: string) {
  return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }))
}

function softwareCredential(rpId: string, challenge: string, origin: string) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const jwk = publicKey.export({ format: 'jwk' })
  const credentialId = randomBytes(24)
  const coseKey = cbor(
    new Map<number, unknown>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x!, 'base64url')],
      [-3, Buffer.from(jwk.y!, 'base64url')],
    ])
  )
  const clientDataJSON = clientData('webauthn.create', challenge, origin)
  const authenticatorData = Buffer.concat([
    webAuthnData(rpId, 0x41, 0),
    Buffer.alloc(16),
    Buffer.from([credentialId.length >> 8, credentialId.length & 0xff]),
    credentialId,
    coseKey,
  ])
  const attestationObject = cbor({
    fmt: 'none',
    attStmt: {},
    authData: authenticatorData,
  })
  const registration = {
    id: credentialId.toString('base64url'),
    rawId: credentialId.toString('base64url'),
    type: 'public-key',
    response: {
      clientDataJSON: clientDataJSON.toString('base64url'),
      attestationObject: attestationObject.toString('base64url'),
      transports: ['internal'],
    },
    clientExtensionResults: {},
  }

  let counter = 0
  function assertion(assertionChallenge: string, userVerified = false) {
    const assertionClientDataJSON = clientData('webauthn.get', assertionChallenge, origin)
    const assertionAuthenticatorData = webAuthnData(rpId, userVerified ? 0x05 : 0x01, ++counter)
    const signedData = Buffer.concat([
      assertionAuthenticatorData,
      createHash('sha256').update(assertionClientDataJSON).digest(),
    ])
    return {
      id: credentialId.toString('base64url'),
      rawId: credentialId.toString('base64url'),
      type: 'public-key',
      response: {
        clientDataJSON: assertionClientDataJSON.toString('base64url'),
        authenticatorData: assertionAuthenticatorData.toString('base64url'),
        signature: sign('sha256', signedData, privateKey).toString('base64url'),
        userHandle: null,
      },
      clientExtensionResults: {},
    }
  }

  return { registration, assertion }
}

test.group('Pupitre MFA and passkeys', () => {
  test('enrolls TOTP, rejects wrong codes, consumes recovery codes once, and disables MFA', async ({
    assert,
  }) => {
    const fixture = await createTestApp(options())
    const realNow = Date.now
    Date.now = () => 1_800_000_000_000
    try {
      await User.create({
        name: 'MFA User',
        fullName: 'MFA User',
        email: 'mfa-flow@example.test',
        password: 'correct-password',
      })
      const guest = await fetch(`${fixture.baseUrl}/admin/login`)
      const cookie = cookies(guest)
      const authenticated = await login(
        fixture.baseUrl,
        cookie,
        'mfa-flow@example.test',
        'correct-password'
      )
      assert.equal(authenticated.response.status, 302)
      assert.equal(authenticated.response.headers.get('location'), '/admin')
      const session = { value: authenticated.cookie }
      const requiredGate = await fetch(`${fixture.baseUrl}/admin`, {
        headers: { Cookie: session.value, Accept: 'text/html' },
        redirect: 'manual',
      })
      assert.equal(requiredGate.status, 302)
      assert.equal(requiredGate.headers.get('location'), '/admin/profile')

      const enrollmentResponse = await post(fixture.baseUrl, session, '/profile/mfa/setup')
      assert.equal(enrollmentResponse.status, 200)
      const enrollment = (await enrollmentResponse.json()) as { secret: string; qrCode: string }
      assert.match(enrollment.qrCode, /^data:image\/png;base64,/)
      const code = await generate({ secret: enrollment.secret })
      let wrongCode = '000000'
      let wrongCodeVerification = await verify({ secret: enrollment.secret, token: wrongCode })
      while (wrongCodeVerification.valid) {
        wrongCode = String((Number(wrongCode) + 1) % 1_000_000).padStart(6, '0')
        wrongCodeVerification = await verify({ secret: enrollment.secret, token: wrongCode })
      }
      const wrong = await post(fixture.baseUrl, session, '/profile/mfa/confirm', {
        code: wrongCode,
      })
      assert.equal(wrong.status, 422)
      const confirmed = await post(fixture.baseUrl, session, '/profile/mfa/confirm', { code })
      assert.equal(confirmed.status, 200, await confirmed.clone().text())
      const { recoveryCodes: originalCodes } = (await confirmed.json()) as {
        recoveryCodes: string[]
      }
      assert.lengthOf(originalCodes, 10)
      const replacementCode = await generate({ secret: enrollment.secret })
      const regenerated = await post(fixture.baseUrl, session, '/profile/mfa/recovery-codes', {
        code: replacementCode,
      })
      assert.equal(regenerated.status, 200)
      const { recoveryCodes } = (await regenerated.json()) as { recoveryCodes: string[] }
      assert.lengthOf(recoveryCodes, 10)

      await post(fixture.baseUrl, session, '/logout')
      let challengeLogin = await login(
        fixture.baseUrl,
        session.value,
        'mfa-flow@example.test',
        'correct-password'
      )
      session.value = challengeLogin.cookie
      assert.equal(challengeLogin.response.headers.get('location'), '/admin/mfa/challenge')
      const challengePage = await fetch(`${fixture.baseUrl}/admin/mfa/challenge`, {
        headers: { Cookie: session.value, Accept: 'text/html' },
      })
      assert.equal(challengePage.status, 200)
      for (let attempt = 0; attempt < 5; attempt++) {
        const invalid = await post(fixture.baseUrl, session, '/mfa/challenge', {
          code: wrongCode,
        })
        assert.equal(invalid.status, 302)
        if (attempt === 4) assert.equal(invalid.headers.get('location'), '/admin/login')
      }
      const lockedOut = await post(fixture.baseUrl, session, '/mfa/challenge', {
        code: recoveryCodes[0],
      })
      assert.equal(lockedOut.headers.get('location'), '/admin/login')
      // A new password login cannot reset the per-user MFA budget. Resume after its window.
      Date.now = () => 1_800_000_060_001
      challengeLogin = await login(
        fixture.baseUrl,
        session.value,
        'mfa-flow@example.test',
        'correct-password'
      )
      session.value = challengeLogin.cookie
      assert.equal(challengeLogin.response.headers.get('location'), '/admin/mfa/challenge')
      const oldCode = await post(fixture.baseUrl, session, '/mfa/challenge', {
        code: originalCodes[0],
      })
      assert.equal(oldCode.status, 302, await oldCode.clone().text())
      const accepted = await post(fixture.baseUrl, session, '/mfa/challenge', {
        code: recoveryCodes[0],
      })
      assert.equal(accepted.status, 302)

      await post(fixture.baseUrl, session, '/logout')
      challengeLogin = await login(
        fixture.baseUrl,
        session.value,
        'mfa-flow@example.test',
        'correct-password'
      )
      session.value = challengeLogin.cookie
      const replay = await post(fixture.baseUrl, session, '/mfa/challenge', {
        code: recoveryCodes[0],
      })
      assert.equal(replay.status, 302)
      const freshCode = await generate({ secret: enrollment.secret })
      await post(fixture.baseUrl, session, '/mfa/challenge', { code: freshCode })
      const disabled = await post(fixture.baseUrl, session, '/profile/mfa/disable', {
        code: freshCode,
      })
      assert.equal(disabled.status, 204)

      const otherUser = await User.create({
        name: 'Other User',
        fullName: 'Other User',
        email: 'other-passkey@example.test',
        password: 'correct-password',
      })
      await fixture.database.table('pupitre_passkeys').insert({
        user_id: otherUser.id,
        credential_id: 'other-users-credential',
        public_key: Buffer.from('not-used-in-delete-test').toString('base64url'),
        counter: 0,
        transports: '[]',
        device_type: 'singleDevice',
        backed_up: false,
        name: 'Private credential',
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      const [passkey] = await fixture.database
        .from('pupitre_passkeys')
        .where('user_id', otherUser.id)
        .select('id')
      const unauthorizedDelete = await fetch(
        `${fixture.baseUrl}/admin/profile/passkeys/${passkey!.id}`,
        {
          method: 'DELETE',
          headers: { Cookie: session.value, Accept: 'application/json' },
          redirect: 'manual',
        }
      )
      assert.equal(unauthorizedDelete.status, 404)
    } finally {
      Date.now = realNow
      await closeTestApp(fixture)
    }
  })
  test('registers and authenticates a software passkey, consumes challenges, and scopes management', async ({
    assert,
  }) => {
    const fixture = await createTestApp(options())
    try {
      const user = await User.create({
        name: 'Passkey User',
        fullName: 'Passkey User',
        email: 'passkey-flow@example.test',
        password: 'correct-password',
      })
      const otherUser = await User.create({
        name: 'Other Passkey User',
        fullName: 'Other Passkey User',
        email: 'other-passkey-flow@example.test',
        password: 'correct-password',
      })
      const guest = await fetch(`${fixture.baseUrl}/admin/login`)
      const authenticated = await login(
        fixture.baseUrl,
        cookies(guest),
        'passkey-flow@example.test',
        'correct-password'
      )
      assert.equal(authenticated.response.status, 302)
      const session = { value: authenticated.cookie }
      const registrationOptionsResponse = await post(
        fixture.baseUrl,
        session,
        '/profile/passkeys/register/options'
      )
      assert.equal(registrationOptionsResponse.status, 200)
      const registrationOptions = (await registrationOptionsResponse.json()) as {
        challenge: string
      }
      const rpId = new URL(fixture.baseUrl).hostname
      const credential = softwareCredential(rpId, registrationOptions.challenge, fixture.baseUrl)
      const registrationResponse = await post(
        fixture.baseUrl,
        session,
        '/profile/passkeys/register/verify',
        { name: 'Software credential', credential: credential.registration }
      )
      assert.equal(registrationResponse.status, 201, await registrationResponse.clone().text())
      const registered = (await registrationResponse.json()) as { credentialId: string }
      const [passkey] = await fixture.database
        .from('pupitre_passkeys')
        .where('credential_id', registered.credentialId)
      assert.exists(passkey)

      await fixture.database.table('pupitre_passkeys').insert({
        user_id: otherUser.id,
        credential_id: 'other-account-passkey',
        public_key: Buffer.from('not-used-in-authorization-test').toString('base64url'),
        counter: 0,
        transports: '[]',
        device_type: 'singleDevice',
        backed_up: false,
        name: 'Private credential',
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      const [otherPasskey] = await fixture.database
        .from('pupitre_passkeys')
        .where('credential_id', 'other-account-passkey')
      const renameOtherPasskey = await fetch(
        `${fixture.baseUrl}/admin/profile/passkeys/${otherPasskey!.id}`,
        {
          method: 'PATCH',
          headers: {
            'Cookie': session.value,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Stolen credential' }),
          redirect: 'manual',
        }
      )
      assert.equal(renameOtherPasskey.status, 404)
      const deleteOtherPasskey = await fetch(
        `${fixture.baseUrl}/admin/profile/passkeys/${otherPasskey!.id}`,
        {
          method: 'DELETE',
          headers: { Cookie: session.value, Accept: 'application/json' },
          redirect: 'manual',
        }
      )
      assert.equal(deleteOtherPasskey.status, 404)

      await fixture.database
        .from('users')
        .where('id', user.id)
        .update({ mfa_enabled_at: new Date().toISOString() })
      await post(fixture.baseUrl, session, '/logout')
      const authOptionsResponse = await fetch(`${fixture.baseUrl}/admin/passkeys/login/options`, {
        headers: { Cookie: session.value, Accept: 'application/json' },
      })
      session.value = cookies(authOptionsResponse, session.value)
      const authOptions = (await authOptionsResponse.json()) as { challenge: string }
      const assertion = credential.assertion(authOptions.challenge)
      const noUvAuth = await post(fixture.baseUrl, session, '/passkeys/login/verify', {
        credential: assertion,
      })
      assert.equal(noUvAuth.status, 302)
      assert.equal(noUvAuth.headers.get('location'), '/admin/mfa/challenge')

      const uvOptionsResponse = await fetch(`${fixture.baseUrl}/admin/passkeys/login/options`, {
        headers: { Cookie: session.value, Accept: 'application/json' },
      })
      session.value = cookies(uvOptionsResponse, session.value)
      const uvOptions = (await uvOptionsResponse.json()) as { challenge: string }
      const authResponse = await post(fixture.baseUrl, session, '/passkeys/login/verify', {
        credential: credential.assertion(uvOptions.challenge, true),
      })
      assert.equal(authResponse.status, 302)
      assert.equal(authResponse.headers.get('location'), '/admin')

      const [usedPasskey] = await fixture.database
        .from('pupitre_passkeys')
        .where('credential_id', registered.credentialId)
      assert.equal(Number(usedPasskey!.counter), 2)
      assert.isNotNull(usedPasskey!.last_used_at)
      const replay = await post(fixture.baseUrl, session, '/passkeys/login/verify', {
        credential: assertion,
      })
      assert.equal(replay.status, 422)

      const deleteOwnPasskey = await fetch(
        `${fixture.baseUrl}/admin/profile/passkeys/${usedPasskey!.id}`,
        {
          method: 'DELETE',
          headers: { Cookie: session.value, Accept: 'application/json' },
          redirect: 'manual',
        }
      )
      assert.equal(deleteOwnPasskey.status, 204, await deleteOwnPasskey.clone().text())
      assert.notExists(
        await fixture.database.from('pupitre_passkeys').where('id', usedPasskey!.id).first()
      )
      assert.exists(
        await fixture.database.from('pupitre_passkeys').where('id', otherPasskey!.id).first()
      )
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('registers security routes without full profile settings', async ({ assert }) => {
    const securityPanel = definePanel('security')
      .path('/security')
      .login()
      .mfa({ required: true })
      .passkeys()
    const fixture = await createTestApp(options(securityPanel))
    try {
      await User.create({
        name: 'Security User',
        fullName: 'Security User',
        email: 'security@example.test',
        password: 'correct-password',
      })
      const guest = await fetch(`${fixture.baseUrl}/security/login`)
      const authenticated = await login(
        fixture.baseUrl,
        cookies(guest),
        'security@example.test',
        'correct-password',
        '/security'
      )
      assert.equal(authenticated.response.headers.get('location'), '/security')
      const cookie = { value: authenticated.cookie }
      const gate = await fetch(`${fixture.baseUrl}/security`, {
        headers: { Cookie: cookie.value, Accept: 'text/html' },
        redirect: 'manual',
      })
      assert.equal(gate.headers.get('location'), '/security/profile')
      const securityPage = await fetch(`${fixture.baseUrl}/security/profile`, {
        headers: { Cookie: cookie.value, Accept: 'text/html' },
      })
      assert.equal(securityPage.status, 200)
      const setup = await post(
        fixture.baseUrl,
        cookie,
        '/profile/mfa/setup',
        undefined,
        '/security'
      )
      assert.equal(setup.status, 200)
      const passkeys = await fetch(`${fixture.baseUrl}/security/profile/passkeys`, {
        headers: { Cookie: cookie.value, Accept: 'application/json' },
      })
      assert.equal(passkeys.status, 200)
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('does not challenge users for MFA disabled on this panel', async ({ assert }) => {
    setWebAuthnLoaderForTests(async () => {
      throw new Error('simulated optional peer absence')
    })
    try {
      await assert.rejects(
        () => authenticationOptions({} as never, {} as never),
        /E_PUPITRE_MISSING_PEER: passkeys require the optional "@simplewebauthn\/server" dependency/
      )
    } finally {
      setWebAuthnLoaderForTests()
    }
    const fixture = await createTestApp(
      options(definePanel('plain').path('/plain').login().profile())
    )
    try {
      await User.create({
        name: 'Regular User',
        fullName: 'Regular User',
        email: 'plain@example.test',
        password: 'correct-password',
        mfaEnabledAt: DateTime.now(),
      })
      const guest = await fetch(`${fixture.baseUrl}/plain/login`)
      const result = await fetch(`${fixture.baseUrl}/plain/login`, {
        method: 'POST',
        headers: {
          'Cookie': cookies(guest),
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html',
        },
        body: new URLSearchParams({ email: 'plain@example.test', password: 'correct-password' }),
        redirect: 'manual',
      })
      assert.equal(result.status, 302)
      assert.equal(result.headers.get('location'), '/plain')
      const response = await fetch(`${fixture.baseUrl}/plain/profile`, {
        headers: { Cookie: cookies(result), Accept: 'text/html' },
      })
      assert.equal(response.status, 200)
    } finally {
      await closeTestApp(fixture)
    }
  })
})
