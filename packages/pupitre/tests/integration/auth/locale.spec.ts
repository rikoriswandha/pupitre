import { test } from '@japa/runner'
import { definePanel } from '../../../index.js'
import type { PupitreMailMessage } from '../../../src/adapters/mail.js'
import { closeTestApp, createTestApp, User } from '../../helpers/app.js'

function cookies(response: Response, previous: string) {
  const parts = new Map(
    previous
      .split('; ')
      .filter(Boolean)
      .map((pair) => {
        const split = pair.indexOf('=')
        return [pair.slice(0, split), pair.slice(split + 1)]
      })
  )
  for (const item of response.headers.getSetCookie()) {
    const pair = item.split(';', 1)[0]!
    const split = pair.indexOf('=')
    if (split > 0) parts.set(pair.slice(0, split), pair.slice(split + 1))
  }
  return [...parts].map(([key, value]) => `${key}=${value}`).join('; ')
}

const inertiaHeaders = { 'Accept': 'text/html', 'X-Inertia': 'true', 'X-Inertia-Version': '1' }
type ProfilePage = {
  props: {
    pupitre: { locale: string }
    page: {
      state: { data: Record<string, unknown> }
      spec: { elements: Record<string, { type: string; props: Record<string, unknown> }> }
    }
    errors: Record<string, string>
  }
}

test.group('Auth localization', () => {
  for (const localeColumn of [undefined, 'fullName']) {
    const storage = localeColumn
      ? 'session and mapped model column'
      : 'session without a model column'
    test(`persists profile locale in the ${storage}`, async ({ assert }) => {
      const panel = definePanel('admin').path('/admin').login().profile().locales(['en', 'id'])
      const fixture = await createTestApp({
        panels: { admin: async () => ({ default: panel }) },
        pupitre: {
          auth: {
            model: async () => ({ default: User }),
            columns: { name: 'name', ...(localeColumn ? { locale: localeColumn } : {}) },
          },
        },
      })
      try {
        const user = await User.create({
          name: 'Locale User',
          fullName: localeColumn ? 'en' : 'Unchanged name',
          email: `locale-${localeColumn ?? 'session'}@example.test`,
          password: 'locale-password',
        })
        let cookie = await fixture.loginAs(user)
        const before = await fetch(`${fixture.baseUrl}/admin/profile`, {
          headers: { ...inertiaHeaders, Cookie: cookie },
        })
        assert.equal(before.status, 200)
        const initial = (await before.json()) as ProfilePage
        assert.isTrue(
          Object.values(initial.props.page.spec.elements).some(
            (element) => element.props.name === 'locale'
          )
        )
        assert.equal(initial.props.page.state.data.locale, 'en')

        const changed = await fetch(`${fixture.baseUrl}/admin/profile`, {
          method: 'PUT',
          headers: {
            'Cookie': cookie,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html',
          },
          body: new URLSearchParams({ name: 'Locale User', locale: 'id' }),
          redirect: 'manual',
        })
        assert.equal(changed.status, 302)
        cookie = cookies(changed, cookie)
        const after = await fetch(`${fixture.baseUrl}/admin/profile`, {
          headers: { ...inertiaHeaders, Cookie: cookie },
        })
        assert.equal(after.status, 200)
        const localized = (await after.json()) as ProfilePage
        assert.equal(localized.props.pupitre.locale, 'id')
        assert.equal(localized.props.page.state.data.locale, 'id')
        const saved = await User.findOrFail(user.id)
        assert.equal(saved.fullName, localeColumn ? 'id' : 'Unchanged name')

        const rejected = await fetch(`${fixture.baseUrl}/admin/profile`, {
          method: 'PUT',
          headers: {
            'Cookie': cookie,
            'Referer': `${fixture.baseUrl}/admin/profile`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html',
          },
          body: new URLSearchParams({ name: 'Must not save', locale: 'fr' }),
          redirect: 'manual',
        })
        assert.equal(rejected.status, 302)
        cookie = cookies(rejected, cookie)
        const unchanged = await fetch(`${fixture.baseUrl}/admin/profile`, {
          headers: { ...inertiaHeaders, Cookie: cookie },
        })
        const unchangedPage = (await unchanged.json()) as ProfilePage
        assert.equal(unchangedPage.props.pupitre.locale, 'id')
        assert.property(unchangedPage.props.errors, 'locale')
        const unchangedUser = await User.findOrFail(user.id)
        assert.equal(unchangedUser.name, 'Locale User')
      } finally {
        await closeTestApp(fixture)
      }
    })
  }

  test('omits language selection and rejects locale changes for a single-locale panel', async ({
    assert,
  }) => {
    const panel = definePanel('admin').path('/admin').login().profile()
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { auth: { model: async () => ({ default: User }), columns: { name: 'name' } } },
    })
    try {
      const user = await User.create({
        name: 'Single Locale',
        email: 'single@example.test',
        password: 'password',
      })
      const cookie = await fixture.loginAs(user)
      const response = await fetch(`${fixture.baseUrl}/admin/profile`, {
        headers: { ...inertiaHeaders, Cookie: cookie },
      })
      const page = (await response.json()) as ProfilePage
      assert.isFalse(
        Object.values(page.props.page.spec.elements).some(
          (element) => element.props.name === 'locale'
        )
      )
      const update = await fetch(`${fixture.baseUrl}/admin/profile`, {
        method: 'PUT',
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html',
        },
        body: new URLSearchParams({ name: 'Must not save', locale: 'id' }),
        redirect: 'manual',
      })
      assert.equal(update.status, 302)
      const unchangedUser = await User.findOrFail(user.id)
      assert.equal(unchangedUser.name, 'Single Locale')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('delivers localized reset and verification mail with actionable links', async ({
    assert,
  }) => {
    const messages: PupitreMailMessage[] = []
    const panel = definePanel('admin')
      .path('/admin')
      .login()
      .registration()
      .passwordReset()
      .emailVerification()
      .locale('id')
      .locales(['en', 'id'])
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: {
        auth: { model: async () => ({ default: User }), columns: { name: 'name' } },
        mail: {
          async send(message) {
            messages.push(message)
          },
        },
        i18n: {
          messages: {
            id: {
              'Reset your password': 'Atur ulang kata sandi',
              'Reset your password: {url}': 'Atur ulang kata sandi: {url}',
              '<p>Reset your password: <a href="{url}">Continue</a></p>':
                '<p>Atur ulang kata sandi: <a href="{url}">Lanjutkan</a></p>',
              'Verify your email address': 'Verifikasi alamat email',
              'Verify your email address: {url}': 'Verifikasi alamat email: {url}',
              '<p>Verify your email address: <a href="{url}">Continue</a></p>':
                '<p>Verifikasi alamat email: <a href="{url}">Lanjutkan</a></p>',
            },
          },
        },
      },
    })
    try {
      const registration = await fetch(`${fixture.baseUrl}/admin/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({
          name: 'Mail User',
          email: 'mail@example.test',
          password: 'mail-password',
        }),
        redirect: 'manual',
      })
      assert.equal(registration.headers.get('location'), '/admin/email/verify')
      assert.lengthOf(messages, 1)
      assert.equal(messages[0]!.to, 'mail@example.test')
      assert.equal(messages[0]!.subject, 'Verifikasi alamat email')
      assert.include(messages[0]!.html, 'Lanjutkan')
      const verificationUrl = messages[0]!.text.match(/https?:\/\/\S+/)?.[0]
      assert.isString(verificationUrl)
      assert.include(messages[0]!.html, verificationUrl!)
      const verified = await fetch(verificationUrl!, { redirect: 'manual' })
      assert.equal(verified.headers.get('location'), '/admin/login')
      const verifiedUser = await User.findByOrFail('email', 'mail@example.test')
      assert.isNotNull(verifiedUser.emailVerifiedAt)

      const reset = await fetch(`${fixture.baseUrl}/admin/password/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({ email: 'mail@example.test' }),
        redirect: 'manual',
      })
      assert.equal(reset.status, 302)
      assert.lengthOf(messages, 2)
      assert.equal(messages[1]!.subject, 'Atur ulang kata sandi')
      assert.include(messages[1]!.html, 'Lanjutkan')
      const resetUrl = messages[1]!.text.match(/https?:\/\/\S+/)?.[0]
      assert.isString(resetUrl)
      assert.include(messages[1]!.html, resetUrl!)
      const updated = await fetch(resetUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html' },
        body: new URLSearchParams({
          password: 'changed-password',
          password_confirmation: 'changed-password',
        }),
        redirect: 'manual',
      })
      assert.equal(updated.headers.get('location'), '/admin/login')
      const updatedUser = await User.findByOrFail('email', 'mail@example.test')
      assert.equal(updatedUser.password, 'changed-password')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('returns request-localized Vine errors for passkey names', async ({ assert }) => {
    const panel = definePanel('admin')
      .path('/admin')
      .login()
      .passkeys()
      .locale('id')
      .locales(['en', 'id'])
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: {
        auth: { model: async () => ({ default: User }), columns: { name: 'name' } },
        i18n: {
          messages: {
            id: { 'The {field} field must be defined': '{field} wajib diisi.' },
          },
        },
      },
    })
    try {
      const user = await User.create({
        name: 'Validation User',
        email: 'validation@example.test',
        password: 'validation-password',
      })
      const cookie = await fixture.loginAs(user)
      const response = await fetch(`${fixture.baseUrl}/admin/profile/passkeys/1`, {
        method: 'PATCH',
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({}),
      })
      assert.equal(response.status, 422)
      const body = (await response.json()) as {
        errors: { field: string; message: string }[]
      }
      assert.equal(
        body.errors.find((error) => error.field === 'name')?.message,
        'name wajib diisi.'
      )
    } finally {
      await closeTestApp(fixture)
    }
  })
})
