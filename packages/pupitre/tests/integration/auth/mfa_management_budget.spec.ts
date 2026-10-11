import { test } from '@japa/runner'
import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import { generate, generateSecret } from 'otplib'
import { defineConfig as encryptionConfig, drivers } from '@adonisjs/core/encryption'
import { definePanel } from '../../../index.js'
import { consumeRecoveryCode } from '../../../src/auth/recovery_code.js'
import { clearMfaLimit } from '../../../src/auth/mfa_limit.js'
import { closeTestApp, createTestApp, testSessionAuthentication, User } from '../../helpers/app.js'

const panel = definePanel('admin')
  .path('/admin')
  .login()
  .profile()
  .mfa()
  .middleware([testSessionAuthentication])
const options = {
  panels: { admin: async () => ({ default: panel }) },
  pupitre: { auth: { model: async () => ({ default: User }), columns: { name: 'name' } } },
  config: {
    encryption: encryptionConfig({
      default: 'gcm',
      list: {
        gcm: drivers.aes256gcm({ keys: ['01234567890123456789012345678901'], id: 'gcm' }),
      },
    }),
  },
}
const digest = (code: string) => createHash('sha256').update(code).digest('hex')

test.group('MFA management security', () => {
  test('recovery codes are single-use across concurrent same-code and different-code consumers', async ({
    assert,
  }) => {
    const fixture = await createTestApp(options)
    try {
      const user = await User.create({
        name: 'Atomic',
        fullName: 'Atomic',
        email: 'atomic-mfa@example.test',
        password: 'password',
        mfaRecoveryCodes: JSON.stringify(['same', 'one', 'two'].map(digest)),
      })
      const sameCode = await Promise.all([
        consumeRecoveryCode(User, String(user.id), 'mfaRecoveryCodes', 'same'),
        consumeRecoveryCode(User, String(user.id), 'mfaRecoveryCodes', 'same'),
      ])
      assert.equal(sameCode.filter(Boolean).length, 1)
      const differentCodes = await Promise.all([
        consumeRecoveryCode(User, String(user.id), 'mfaRecoveryCodes', 'one'),
        consumeRecoveryCode(User, String(user.id), 'mfaRecoveryCodes', 'two'),
      ])
      assert.deepEqual(differentCodes, [true, true])
      await user.refresh()
      assert.equal(user.mfaRecoveryCodes, '[]')
      for (const code of ['same', 'one', 'two']) {
        const replay = await consumeRecoveryCode(User, String(user.id), 'mfaRecoveryCodes', code)
        assert.isFalse(replay)
      }
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('regeneration and password disable share the challenge budget and successful verification clears it', async ({
    assert,
  }) => {
    const fixture = await createTestApp(options)
    const realNow = Date.now
    let now = realNow()
    Date.now = () => now
    let key = ''
    try {
      const secret = generateSecret()
      // Encryption's service proxy is only available after this fixture app has booted.
      const { default: encryption } = await import('@adonisjs/core/services/encryption')
      const user = await User.create({
        name: 'Management',
        fullName: 'Management',
        email: 'management-mfa@example.test',
        password: 'correct-password',
        mfaEnabledAt: DateTime.now(),
        mfaSecret: encryption.encrypt(secret),
        mfaRecoveryCodes: JSON.stringify([digest('existing')]),
      })
      key = digest(`mfa:${user.id}`)
      const login = await fetch(`${fixture.baseUrl}/__test/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id }),
      })
      assert.equal(login.status, 204, await login.clone().text())
      const cookie = login.headers
        .getSetCookie()
        .map((header) => header.split(';', 1)[0])
        .join('; ')
      const post = (route: string, body: Record<string, string>) =>
        fetch(`${fixture.baseUrl}/admin/profile/mfa/${route}`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cookie': cookie,
          },
          body: JSON.stringify(body),
          redirect: 'manual',
        })
      for (let index = 0; index < 5; index++) {
        const response =
          index < 2
            ? await post('recovery-codes', {})
            : await post('disable', { current_password: 'wrong-password' })
        assert.equal(response.status, 422, await response.clone().text())
      }
      const token = await generate({ secret })
      const blockedRegeneration = await post('recovery-codes', { code: token })
      const blockedDisable = await post('disable', { current_password: 'correct-password' })
      assert.equal(blockedRegeneration.status, 429)
      assert.equal(blockedDisable.status, 429)
      await user.refresh()
      assert.equal(user.mfaRecoveryCodes, JSON.stringify([digest('existing')]))
      assert.isNotNull(user.mfaEnabledAt)
      now += 60_001
      const freshToken = await generate({ secret })
      const regenerated = await post('recovery-codes', { code: freshToken })
      assert.equal(regenerated.status, 200, await regenerated.clone().text())
      const invalidDisable = await post('disable', { current_password: 'wrong-password' })
      assert.equal(invalidDisable.status, 422)
      const disabled = await post('disable', { current_password: 'correct-password' })
      assert.equal(disabled.status, 204, await disabled.clone().text())
      await user.refresh()
      assert.isNull(user.mfaEnabledAt)
    } finally {
      if (key) await clearMfaLimit(key)
      Date.now = realNow
      await closeTestApp(fixture)
    }
  })
})
