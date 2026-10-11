import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { test } from '@japa/runner'
import { definePanel } from '../../../index.js'
import type { MailAdapter, PupitreMailMessage } from '../../../src/adapters/mail.js'
import { closeTestApp, createTestApp, User } from '../../helpers/app.js'
import { pruneExpiredPasswordResets } from '../../../commands/prune.js'

const panel = definePanel('admin')
  .path('/admin')
  .login()
  .registration()
  .passwordReset()
  .profile({ avatar: true })

function options(mail: MailAdapter, authPanel = panel) {
  return {
    panels: { admin: async () => ({ default: authPanel }) },
    pupitre: {
      auth: {
        model: async () => ({ default: User }),
        columns: { name: 'name' },
      },
      mail,
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

test.group('Pupitre auth runtime', () => {
  test('authenticates, rejects invalid credentials, constrains redirect targets, and logs out', async ({
    assert,
  }) => {
    const fixture = await createTestApp(options({ async send() {} }))
    try {
      await User.create({
        name: 'Auth User',
        fullName: 'Auth User',
        email: 'auth@example.test',
        password: 'correct-password',
      })
      const invalid = await fetch(`${fixture.baseUrl}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({ email: 'auth@example.test', password: 'wrong-password' }),
        redirect: 'manual',
      })
      assert.equal(invalid.status, 302)
      assert.equal(invalid.headers.get('location'), '/')

      const valid = await fetch(`${fixture.baseUrl}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({
          email: 'auth@example.test',
          password: 'correct-password',
          redirect: '//evil.example/steal',
        }),
        redirect: 'manual',
      })
      assert.equal(valid.status, 302)
      assert.equal(valid.headers.get('location'), '/admin')
      const cookie = cookies(valid)
      const protectedPage = await fetch(`${fixture.baseUrl}/admin/profile`, {
        headers: { Cookie: cookie, Accept: 'text/html' },
        redirect: 'manual',
      })
      assert.equal(protectedPage.status, 200)

      const logout = await fetch(`${fixture.baseUrl}/admin/logout`, {
        method: 'POST',
        headers: { Cookie: cookie, Accept: 'text/html' },
        redirect: 'manual',
      })
      assert.equal(logout.status, 302)
      assert.equal(logout.headers.get('location'), '/admin/login')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('renders guest auth forms and returns redirect or JSON for unauthenticated protected requests', async ({
    assert,
  }) => {
    const fixture = await createTestApp(options({ async send() {} }))
    try {
      for (const route of [
        '/admin/login',
        '/admin/password/forgot',
        '/admin/register',
        '/admin/password/reset/example-token',
      ]) {
        const response = await fetch(`${fixture.baseUrl}${route}`, {
          headers: { Accept: 'text/html' },
        })
        const body = await response.text()
        assert.equal(response.status, 200, `${route}: ${body}`)
      }
      const html = await fetch(`${fixture.baseUrl}/admin/profile`, {
        headers: { Accept: 'text/html' },
        redirect: 'manual',
      })
      assert.equal(html.status, 302)
      assert.include(html.headers.get('location') ?? '', '/admin/login?redirect=')
      const home = await fetch(`${fixture.baseUrl}/admin`, {
        headers: { Accept: 'text/html' },
        redirect: 'manual',
      })
      assert.equal(home.status, 302)
      assert.include(home.headers.get('location') ?? '', '/admin/login?redirect=')

      const json = await fetch(`${fixture.baseUrl}/admin/profile`, {
        headers: { Accept: 'application/json' },
        redirect: 'manual',
      })
      assert.equal(json.status, 401)
      const jsonBody = (await json.json()) as { message?: unknown }
      assert.isDefined(jsonBody.message)
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('shares invalid-credential field errors through the Inertia validation bag', async ({
    assert,
  }) => {
    const fixture = await createTestApp(options({ async send() {} }))
    try {
      await User.create({
        name: 'Failed Login User',
        fullName: 'Failed Login User',
        email: 'failed-login@example.test',
        password: 'correct-password',
      })
      const loginPage = await fetch(`${fixture.baseUrl}/admin/login`, {
        headers: { Accept: 'text/html' },
      })
      const cookie = cookies(loginPage)
      const failedLogin = await fetch(`${fixture.baseUrl}/admin/login`, {
        method: 'POST',
        headers: {
          'Cookie': cookie,
          'Referer': `${fixture.baseUrl}/admin/login`,
          'Accept': 'text/html',
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: 'failed-login@example.test',
          password: 'wrong-password',
        }),
        redirect: 'manual',
      })
      assert.isTrue([302, 303].includes(failedLogin.status))
      const errorPageUrl = new URL(
        failedLogin.headers.get('location') ?? '/admin/login',
        fixture.baseUrl
      )
      const errorPage = await fetch(errorPageUrl, {
        headers: {
          'Cookie': cookies(failedLogin, cookie),
          'Accept': 'text/html',
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
        },
      })
      const page = (await errorPage.json()) as { props: { errors: Record<string, string> } }
      assert.equal(page.props.errors.email, 'These credentials do not match our records')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('sends a hashed one-time reset token without revealing unknown accounts', async ({
    assert,
  }) => {
    const messages: PupitreMailMessage[] = []
    const mail: MailAdapter = {
      async send(message) {
        messages.push(message)
      },
    }
    const fixture = await createTestApp(options(mail))
    try {
      const user = await User.create({
        name: 'Reset User',
        fullName: 'Reset User',
        email: 'reset@example.test',
        password: 'old-password',
      })
      const send = (email: string) =>
        fetch(`${fixture.baseUrl}/admin/password/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
          body: new URLSearchParams({ email }),
          redirect: 'manual',
        })
      const known = await send('reset@example.test')
      const unknown = await send('missing@example.test')
      assert.equal(known.status, 302)
      assert.equal(unknown.status, known.status)
      assert.equal(messages.length, 1)
      const resetUrl = messages[0]!.text.match(/https?:\/\/\S+/)?.[0]
      assert.isString(resetUrl)
      const token = new URL(resetUrl!).pathname.split('/').at(-1)!
      const row = await fixture.database
        .from('pupitre_password_resets')
        .where('user_id', user.id)
        .first()
      assert.equal(row?.token_hash, createHash('sha256').update(token).digest('hex'))

      const reset = await fetch(resetUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({
          password: 'new-password',
          password_confirmation: 'new-password',
        }),
        redirect: 'manual',
      })
      assert.equal(reset.status, 302)
      assert.equal(reset.headers.get('location'), '/admin/login')
      const reused = await fetch(resetUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({
          password: 'other-password',
          password_confirmation: 'other-password',
        }),
        redirect: 'manual',
      })
      assert.equal(reused.status, 302)
      const wrongToken = await fetch(`${fixture.baseUrl}/admin/password/reset/not-a-valid-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({
          password: 'other-password',
          password_confirmation: 'other-password',
        }),
        redirect: 'manual',
      })
      assert.equal(wrongToken.status, 302)

      const expiredToken = 'expired-reset-token'
      await fixture.database.table('pupitre_password_resets').insert({
        user_id: user.id,
        guard: 'web',
        token_hash: createHash('sha256').update(expiredToken).digest('hex'),
        expires_at: '2000-01-01 00:00:00',
        created_at: '2000-01-01 00:00:00',
      })
      const expired = await fetch(`${fixture.baseUrl}/admin/password/reset/${expiredToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({
          password: 'other-password',
          password_confirmation: 'other-password',
        }),
        redirect: 'manual',
      })
      assert.equal(expired.status, 302)
      assert.isNull(
        await fixture.database
          .from('pupitre_password_resets')
          .where('token_hash', createHash('sha256').update(expiredToken).digest('hex'))
          .first()
      )
      const otherGuardToken = 'other-guard-token'
      await fixture.database.table('pupitre_password_resets').insert({
        user_id: user.id,
        guard: 'api',
        token_hash: createHash('sha256').update(otherGuardToken).digest('hex'),
        expires_at: '2099-01-01 00:00:00',
        created_at: '2026-01-01 00:00:00',
      })
      const otherGuard = await fetch(`${fixture.baseUrl}/admin/password/reset/${otherGuardToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({
          password: 'other-password',
          password_confirmation: 'other-password',
        }),
        redirect: 'manual',
      })
      assert.equal(otherGuard.status, 302)
      const signedIn = await fetch(`${fixture.baseUrl}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({ email: 'reset@example.test', password: 'new-password' }),
        redirect: 'manual',
      })
      assert.equal(signedIn.headers.get('location'), '/admin')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('requires the current password for credential changes and stores avatar replacements', async ({
    assert,
  }) => {
    const fixture = await createTestApp(options({ async send() {} }))
    try {
      const user = await User.create({
        name: 'Profile User',
        fullName: 'Profile User',
        email: 'profile@example.test',
        password: 'current-password',
      })
      const oldKey = `avatars/${user.id}/previous.png`
      await user.merge({ avatar: oldKey }).save()
      await mkdir(join(fixture.storagePath, `avatars/${user.id}`), { recursive: true })
      await writeFile(join(fixture.storagePath, oldKey), Buffer.from('old avatar'))
      const cookie = await fixture.loginAs(user)

      const missingCurrent = await fetch(`${fixture.baseUrl}/admin/profile`, {
        method: 'PUT',
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html',
        },
        body: new URLSearchParams({
          name: 'Changed',
          email: 'changed@example.test',
          password: 'next-password',
        }),
        redirect: 'manual',
      })
      assert.equal(missingCurrent.status, 302)
      const afterRejectedChange = await User.findOrFail(user.id)
      assert.equal(afterRejectedChange.email, 'profile@example.test')

      for (const activeBytes of [
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
        '<!doctype html><script>alert(1)</script>',
      ]) {
        const activeUpload = new FormData()
        activeUpload.append('resource', 'profile')
        activeUpload.append('field', 'avatar')
        activeUpload.append('record', String(user.id))
        activeUpload.append('file', new Blob([activeBytes], { type: 'image/png' }), 'spoofed.png')
        const rejected = await fetch(`${fixture.baseUrl}/admin/profile/avatar`, {
          method: 'POST',
          headers: { Cookie: cookie, Accept: 'application/json' },
          body: activeUpload,
        })
        assert.equal(rejected.status, 422)
        await rejected.arrayBuffer()
        const directProfile = new FormData()
        directProfile.append(
          'avatar',
          new Blob([activeBytes], { type: 'image/png' }),
          'spoofed.png'
        )
        const rejectedProfile = await fetch(`${fixture.baseUrl}/admin/profile`, {
          method: 'PUT',
          headers: { Cookie: cookie, Accept: 'text/html' },
          body: directProfile,
          redirect: 'manual',
        })
        assert.equal(rejectedProfile.status, 302)
        const afterRejectedAvatar = await User.findOrFail(user.id)
        assert.equal(afterRejectedAvatar.avatar, oldKey)
      }

      const uploadForm = new FormData()
      uploadForm.append('field', 'avatar')
      uploadForm.append('resource', 'profile')
      uploadForm.append('record', String(user.id))
      uploadForm.append(
        'file',
        new Blob(
          [
            Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=',
              'base64'
            ),
          ],
          { type: 'image/png' }
        ),
        'avatar.png'
      )
      const upload = await fetch(`${fixture.baseUrl}/admin/profile/avatar`, {
        method: 'POST',
        headers: { Cookie: cookie, Accept: 'application/json' },
        body: uploadForm,
      })
      assert.equal(upload.status, 200)
      const uploaded = (await upload.json()) as { key: string }
      const uploadCookie = cookies(upload, cookie)
      const updated = await fetch(`${fixture.baseUrl}/admin/profile`, {
        method: 'PUT',
        headers: {
          'Cookie': uploadCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html',
        },
        body: new URLSearchParams({
          name: 'Changed Profile',
          email: 'changed@example.test',
          current_password: 'current-password',
          password: 'next-password',
          password_confirmation: 'next-password',
          avatar: uploaded.key,
        }),
        redirect: 'manual',
      })
      assert.equal(updated.status, 302)
      const saved = await User.findOrFail(user.id)
      assert.equal(saved.email, 'changed@example.test')
      assert.equal(saved.name, 'Changed Profile')
      assert.notEqual(saved.avatar, oldKey)
      const savedAvatar = await readFile(join(fixture.storagePath, saved.avatar!))
      assert.isTrue(savedAvatar.byteLength > 0)
      assert.equal(saved.password, 'next-password')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('validates profile email, uniqueness, and confirmed password before saving', async ({
    assert,
  }) => {
    const fixture = await createTestApp(options({ async send() {} }))
    try {
      const user = await User.create({
        name: 'Profile Validation',
        fullName: 'Profile Validation',
        email: 'validated-profile@example.test',
        password: 'current-password',
      })
      await User.create({
        name: 'Existing User',
        fullName: 'Existing User',
        email: 'already-used@example.test',
        password: 'existing-password',
      })
      const cookie = await fixture.loginAs(user)
      const update = (data: Record<string, string>) =>
        fetch(`${fixture.baseUrl}/admin/profile`, {
          method: 'PUT',
          headers: {
            'Cookie': cookie,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html',
          },
          body: new URLSearchParams(data),
          redirect: 'manual',
        })
      const invalidUpdates: Record<string, string>[] = [
        { name: 'Profile Validation', email: 'not-an-email' },
        { name: 'Profile Validation', email: 'already-used@example.test' },
        {
          name: 'Profile Validation',
          email: 'validated-profile@example.test',
          current_password: 'current-password',
          password: 'short',
          password_confirmation: 'short',
        },
        {
          name: 'Profile Validation',
          email: 'validated-profile@example.test',
          current_password: 'current-password',
          password: 'long-password',
          password_confirmation: 'different-password',
        },
      ]
      for (const body of invalidUpdates) {
        const response = await update(body)
        assert.equal(response.status, 302)
      }
      const nameOnly = await update({ name: 'Profile Name Only' })
      assert.equal(nameOnly.status, 302)
      const unchanged = await User.findOrFail(user.id)
      assert.equal(unchanged.name, 'Profile Name Only')
      assert.equal(unchanged.email, 'validated-profile@example.test')
      assert.equal(unchanged.password, 'current-password')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('fails clearly when mail-dependent auth is enabled without a mail adapter', async ({
    assert,
  }) => {
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { auth: { model: async () => ({ default: User }) } },
    })
    try {
      const response = await fetch(`${fixture.baseUrl}/admin/password/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({ email: 'missing-mail@example.test' }),
        redirect: 'manual',
      })
      assert.equal(response.status, 500)
    } finally {
      await closeTestApp(fixture)
    }
    const verificationPanel = definePanel('admin')
      .path('/admin')
      .login()
      .registration()
      .emailVerification()
    const verification = await createTestApp({
      panels: { admin: async () => ({ default: verificationPanel }) },
      pupitre: { auth: { model: async () => ({ default: User }) } },
    })
    try {
      const response = await fetch(`${verification.baseUrl}/admin/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({
          name: 'Missing Mail',
          email: 'missing-verification-mail@example.test',
          password: 'verification-password',
        }),
        redirect: 'manual',
      })
      assert.equal(response.status, 500)
    } finally {
      await closeTestApp(verification)
    }
  })

  test('registration creates and authenticates a user; disabled registration routes are 404', async ({
    assert,
  }) => {
    const fixture = await createTestApp(options({ async send() {} }))
    try {
      const response = await fetch(`${fixture.baseUrl}/admin/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({
          name: 'New User',
          email: 'new@example.test',
          password: 'new-password',
        }),
        redirect: 'manual',
      })
      assert.equal(response.status, 302)
      assert.equal(response.headers.get('location'), '/admin')
      assert.isNotNull(await User.findBy('email', 'new@example.test'))
    } finally {
      await closeTestApp(fixture)
    }

    const disabledPanel = definePanel('admin').path('/admin').guard('web').login()
    const disabled = await createTestApp({
      panels: { admin: async () => ({ default: disabledPanel }) },
      pupitre: { auth: { model: async () => ({ default: User }) } },
    })
    try {
      const response = await fetch(`${disabled.baseUrl}/admin/register`, { redirect: 'manual' })
      assert.equal(response.status, 404)
    } finally {
      await closeTestApp(disabled)
    }
  })
  test('gates unverified users and verifies only with the signed mail link', async ({ assert }) => {
    const messages: PupitreMailMessage[] = []
    const verificationPanel = panel.emailVerification()
    const fixture = await createTestApp(
      options(
        {
          async send(message) {
            messages.push(message)
          },
        },
        verificationPanel
      )
    )
    try {
      const registration = await fetch(`${fixture.baseUrl}/admin/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({
          name: 'Verify User',
          email: 'verify@example.test',
          password: 'verify-password',
        }),
        redirect: 'manual',
      })
      assert.equal(registration.headers.get('location'), '/admin/email/verify')
      assert.equal(messages.length, 1)
      const cookie = cookies(registration)
      const protectedPage = await fetch(`${fixture.baseUrl}/admin/profile`, {
        headers: { Cookie: cookie, Accept: 'text/html' },
        redirect: 'manual',
      })
      assert.equal(protectedPage.status, 302)
      assert.equal(protectedPage.headers.get('location'), '/admin/email/verify')
      const notice = await fetch(`${fixture.baseUrl}/admin/email/verify`, {
        headers: { Cookie: cookie, Accept: 'text/html' },
      })
      assert.equal(notice.status, 200)
      await notice.arrayBuffer()

      const rawLink = messages[0]!.text.match(/https?:\/\/\S+/)?.[0]
      assert.isString(rawLink)
      const url = new URL(rawLink!, fixture.baseUrl)
      const tamperedUrl = new URL(url)
      const parts = tamperedUrl.pathname.split('/')
      parts[parts.length - 1] = `${parts.at(-1)}-tampered`
      tamperedUrl.pathname = parts.join('/')
      const tampered = await fetch(tamperedUrl, { redirect: 'manual' })
      const verified = await fetch(url, { redirect: 'manual' })
      assert.equal(tampered.status, 302)
      assert.equal(verified.status, 302)
      assert.equal(verified.headers.get('location'), '/admin/login')
      const verifiedUser = await User.findBy('email', 'verify@example.test')
      assert.isNotNull(verifiedUser?.emailVerifiedAt)
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('limits repeated login attempts with the host limiter and with the local fallback', async ({
    assert,
  }) => {
    const noLimiter = await createTestApp(options({ async send() {} }))
    try {
      // Rotating emails defeats the per-email failure window; the IP quota (60/min) still applies.
      for (let attempt = 0; attempt < 61; attempt++) {
        const response = await fetch(`${noLimiter.baseUrl}/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
          body: new URLSearchParams({
            email: `none-${attempt}@example.test`,
            password: 'wrong-password',
          }),
          redirect: 'manual',
        })
        assert.equal(response.status, 302)
        assert.equal(response.headers.get('retry-after'), attempt === 60 ? '60' : null)
      }
      const jsonResponse = await fetch(`${noLimiter.baseUrl}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({ email: 'another@example.test', password: 'wrong-password' }),
        redirect: 'manual',
      })
      assert.equal(jsonResponse.status, 429)
      assert.equal(jsonResponse.headers.get('retry-after'), '60')
      assert.deepEqual(await jsonResponse.json(), {
        message: 'Too many attempts. Try again in one minute.',
      })
    } finally {
      await closeTestApp(noLimiter)
    }

    const { defineConfig, stores } = await import('@adonisjs/limiter')
    const limited = await createTestApp({
      ...options({ async send() {} }),
      config: {
        limiter: defineConfig({ default: 'memory', stores: { memory: stores.memory({}) } }),
      },
      providers: [() => import('@adonisjs/limiter/limiter_provider')],
    })
    try {
      await User.create({
        name: 'Repeat Login',
        fullName: 'Repeat Login',
        email: 'repeat@example.test',
        password: 'correct-password',
      })
      for (let attempt = 0; attempt < 6; attempt++) {
        const successfulLogin = await fetch(`${limited.baseUrl}/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
          body: new URLSearchParams({ email: 'repeat@example.test', password: 'correct-password' }),
          redirect: 'manual',
        })
        assert.equal(successfulLogin.status, 302)
        assert.equal(successfulLogin.headers.get('location'), '/admin')
      }
      // Five failures for one email exhaust its window; the sixth is throttled.
      let lastResponse: Response | undefined
      for (let attempt = 0; attempt < 6; attempt++) {
        lastResponse = await fetch(`${limited.baseUrl}/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
          body: new URLSearchParams({ email: 'none@example.test', password: 'wrong-password' }),
          redirect: 'manual',
        })
      }
      assert.equal(lastResponse?.status, 302)
      assert.equal(lastResponse?.headers.get('retry-after'), '60')
      const resetAfterLoginLimit = await fetch(`${limited.baseUrl}/admin/password/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({ email: 'none@example.test' }),
        redirect: 'manual',
      })
      assert.equal(resetAfterLoginLimit.status, 302)
      let resetResponse: Response | undefined
      for (let attempt = 0; attempt < 5; attempt++) {
        resetResponse = await fetch(`${limited.baseUrl}/admin/password/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
          body: new URLSearchParams({ email: 'none@example.test' }),
          redirect: 'manual',
        })
      }
      assert.equal(resetResponse?.status, 302)
      assert.equal(resetResponse?.headers.get('retry-after'), '60')
    } finally {
      await closeTestApp(limited)
    }
  })
  test('propagates guard authentication errors when panel login is disabled', async ({
    assert,
  }) => {
    const hostAuthPanel = definePanel('admin').path('/admin').guard('web').login(false)
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: hostAuthPanel }) },
    })
    try {
      const response = await fetch(`${fixture.baseUrl}/admin`, {
        headers: { Accept: 'application/json' },
        redirect: 'manual',
      })
      assert.equal(response.status, 401)
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('prunes expired reset tokens and keeps valid tokens', async ({ assert }) => {
    const fixture = await createTestApp(options({ async send() {} }))
    try {
      const user = await User.create({
        name: 'Prune User',
        fullName: 'Prune User',
        email: 'prune@example.test',
      })
      await fixture.database.table('pupitre_password_resets').insert([
        {
          user_id: user.id,
          guard: 'web',
          token_hash: 'a'.repeat(64),
          expires_at: '2000-01-01 00:00:00',
          created_at: '2000-01-01 00:00:00',
        },
        {
          user_id: user.id,
          guard: 'web',
          token_hash: 'b'.repeat(64),
          expires_at: '2099-01-01 00:00:00',
          created_at: '2026-01-01 00:00:00',
        },
      ])

      const deleted = await pruneExpiredPasswordResets(fixture.database)
      assert.equal(deleted, 1)
      assert.isNull(
        await fixture.database
          .from('pupitre_password_resets')
          .where('token_hash', 'a'.repeat(64))
          .first()
      )
      assert.isNotNull(
        await fixture.database
          .from('pupitre_password_resets')
          .where('token_hash', 'b'.repeat(64))
          .first()
      )
    } finally {
      await closeTestApp(fixture)
    }
  })
})
