import { test } from '@japa/runner'
import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import { definePanel } from '../../../index.js'
import { consumeMfaLimit, clearMfaLimit } from '../../../src/auth/mfa_limit.js'
import { closeTestApp, createTestApp, User } from '../../helpers/app.js'

function cookies(response: Response, previous = '') {
  const pairs = new Map(
    previous
      .split('; ')
      .filter(Boolean)
      .map((pair) => [pair.split('=', 1)[0], pair])
  )
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';', 1)[0]
    pairs.set(pair.split('=', 1)[0], pair)
  }
  return [...pairs.values()].join('; ')
}

test.group('MFA per-user attempt budget', () => {
  test('atomically reserves five concurrent guesses without the optional limiter', async ({
    assert,
  }) => {
    const key = 'mfa-concurrent-regression'
    await clearMfaLimit(key)
    try {
      const results = await Promise.all(Array.from({ length: 20 }, () => consumeMfaLimit(key)))
      assert.equal(results.filter((result) => !result.limited).length, 5)
      const blocked = await consumeMfaLimit(key)
      const otherUser = await consumeMfaLimit(`${key}-other-user`)
      assert.isTrue(blocked.limited)
      assert.isFalse(otherUser.limited)
    } finally {
      await clearMfaLimit(key)
      await clearMfaLimit(`${key}-other-user`)
    }
  })

  test('backend outage and recovery cannot reset the local budget', async ({ assert }) => {
    const key = 'mfa-backend-outage-regression'
    const unavailable = async () => {
      throw new Error('limiter backend unavailable')
    }
    try {
      const results = await Promise.all(
        Array.from({ length: 8 }, () => consumeMfaLimit(key, unavailable))
      )
      assert.equal(results.filter((result) => !result.limited).length, 5)
      const recoveredBackend = await consumeMfaLimit(key, async () => false)
      assert.isTrue(recoveredBackend.limited)
      await clearMfaLimit(key)
      const deniedBackend = await consumeMfaLimit(key, async () => true)
      assert.isTrue(deniedBackend.limited)
    } finally {
      await clearMfaLimit(key)
    }
  })

  test('password re-login cannot reset MFA lockout, but expiry permits verified recovery', async ({
    assert,
  }) => {
    const panel = definePanel('admin').path('/admin').login().mfa()
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { auth: { model: async () => ({ default: User }), columns: { name: 'name' } } },
    })
    const realNow = Date.now
    let now = realNow()
    Date.now = () => now
    try {
      const recovery = 'valid-recovery-code'
      await User.create({
        name: 'Budget',
        fullName: 'Budget',
        email: 'mfa-budget@example.test',
        password: 'correct-password',
        mfaEnabledAt: DateTime.now(),
        mfaRecoveryCodes: JSON.stringify([createHash('sha256').update(recovery).digest('hex')]),
      })
      const guest = await fetch(`${fixture.baseUrl}/admin/login`)
      let cookie = cookies(guest)
      const post = async (route: string, input: Record<string, string>) => {
        const response = await fetch(`${fixture.baseUrl}/admin${route}`, {
          method: 'POST',
          headers: { 'Cookie': cookie, 'Content-Type': 'application/json', 'Accept': 'text/html' },
          body: JSON.stringify(input),
          redirect: 'manual',
        })
        cookie = cookies(response, cookie)
        return response
      }
      for (let attempt = 0; attempt < 5; attempt++) {
        const password = await post('/login', {
          email: 'mfa-budget@example.test',
          password: 'correct-password',
        })
        assert.equal(password.headers.get('location'), '/admin/mfa/challenge')
        await post('/mfa/challenge', { recovery_code: 'wrong-code' })
      }
      await post('/login', { email: 'mfa-budget@example.test', password: 'correct-password' })
      const blocked = await post('/mfa/challenge', { recovery_code: recovery })
      assert.equal(blocked.headers.get('location'), '/admin/login')
      const user = await User.findByOrFail('email', 'mfa-budget@example.test')
      assert.include(user.mfaRecoveryCodes!, createHash('sha256').update(recovery).digest('hex'))
      now += 60_001
      await post('/login', { email: 'mfa-budget@example.test', password: 'correct-password' })
      const accepted = await post('/mfa/challenge', { recovery_code: recovery })
      assert.equal(accepted.headers.get('location'), '/admin')
      await user.refresh()
      assert.equal(user.mfaRecoveryCodes, '[]')
    } finally {
      Date.now = realNow
      await closeTestApp(fixture)
    }
  })
})
