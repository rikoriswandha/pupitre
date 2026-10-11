import { test } from '@japa/runner'
import { definePanel } from '../../../index.js'

test.group('panel MFA configuration', () => {
  test('keeps MFA and passkeys immutable and applies safe defaults', ({ assert }) => {
    const base = definePanel('admin')
    const secured = base.mfa({ required: true, issuer: 'Example' }).passkeys()

    assert.isUndefined(base.toDefinition().auth.mfa)
    assert.isUndefined(base.toDefinition().auth.passkeys)
    assert.deepEqual(secured.toDefinition().auth.mfa, { required: true, issuer: 'Example' })
    assert.deepEqual(secured.toDefinition().auth.passkeys, { enabled: true })
    assert.deepEqual(definePanel('optional').mfa().toDefinition().auth.mfa, {
      required: false,
      issuer: 'Pupitre',
    })
  })
})
