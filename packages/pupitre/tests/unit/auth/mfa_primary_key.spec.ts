import { test } from '@japa/runner'
import { createHash } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { PanelRuntime } from '../../../src/manager.js'
import { completeLogin } from '../../../src/auth/login_flow.js'
import { clearMfaLimit, consumeMfaLimit } from '../../../src/auth/mfa_limit.js'

test.group('MFA custom primary key identity', () => {
  test('pending login uses the actual primary key and shares the management attempt key', async ({
    assert,
  }) => {
    let pending: unknown
    // Deliberately model a user whose primary key is uuid, not an id attribute.
    const user = {
      $primaryKeyValue: 'user-uuid',
      $attributes: { uuid: 'user-uuid', enabled: true },
    } as unknown as LucidRow
    const panel = { guard: 'web', path: '/admin', auth: { mfa: {} } } as unknown as PanelRuntime
    const ctx = {
      containerResolver: { make: async () => ({ auth: { columns: { mfaEnabledAt: 'enabled' } } }) },
      session: {
        put: (_key: string, value: unknown) => {
          pending = value
        },
      },
      response: { redirect: (path: string) => path },
    } as unknown as HttpContext
    const result = await completeLogin(ctx, panel, user)
    assert.equal(result, '/admin/mfa/challenge')
    if (!pending || typeof pending !== 'object' || !('userId' in pending))
      throw new Error('Expected pending MFA login')
    assert.equal(pending.userId, 'user-uuid')
    const challengeKey = createHash('sha256').update(`mfa:${pending.userId}`).digest('hex')
    const managementKey = createHash('sha256').update(`mfa:${user.$primaryKeyValue}`).digest('hex')
    assert.equal(challengeKey, managementKey)
    try {
      for (let attempt = 0; attempt < 5; attempt++) await consumeMfaLimit(managementKey)
      await completeLogin(ctx, panel, user)
      const blocked = await consumeMfaLimit(challengeKey)
      assert.isTrue(blocked.limited)
    } finally {
      await clearMfaLimit(challengeKey)
    }
  })
})
