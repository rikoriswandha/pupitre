import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser'
import { t } from '@rikology/pupitre-react'
import { useEffect, useState } from 'react'

type Passkey = { id: string | number; name: string | null }
export type ProfileSecurityProps = {
  basePath: string
  mfaEnabled: boolean
  passkeysEnabled: boolean
}
type ResponseBody = {
  secret?: string
  qrCode?: string
  recoveryCodes?: string[]
  passkeys?: Passkey[]
  message?: string
}

function csrfToken() {
  const token = document.cookie
    .split('; ')
    .find((part) => part.startsWith('XSRF-TOKEN='))
    ?.split('=')
    .slice(1)
    .join('=')
  return token ? decodeURIComponent(token) : ''
}

export function ProfileSecurity({
  basePath,
  mfaEnabled: initialMfaEnabled,
  passkeysEnabled,
}: ProfileSecurityProps) {
  const [mfaEnabled, setMfaEnabled] = useState(initialMfaEnabled)
  const [enrollment, setEnrollment] = useState<{ secret: string; qrCode: string }>()
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [passkeyName, setPasskeyName] = useState('')
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function request(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(`${basePath}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-XSRF-TOKEN': csrfToken() } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const result = response.status === 204 ? {} : ((await response.json()) as ResponseBody)
    if (!response.ok) throw new Error(result.message ?? t('The request failed'))
    return result
  }

  async function refreshPasskeys() {
    const result = await request('/profile/passkeys')
    setPasskeys(result.passkeys ?? [])
  }

  useEffect(() => {
    if (!passkeysEnabled) return
    let active = true
    void fetch(`${basePath}/profile/passkeys`, { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) return
        const result = (await response.json()) as ResponseBody
        if (active) setPasskeys(result.passkeys ?? [])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [basePath, passkeysEnabled])

  async function run(operation: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await operation()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('The request failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-8 space-y-6 border-t pt-6" aria-label={t('Account security')}>
      <h2 className="text-xl font-semibold">{t('Account security')}</h2>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <section className="space-y-3" aria-labelledby="mfa-heading">
        <h3 id="mfa-heading" className="font-medium">
          {t('Authenticator app')}
        </h3>
        {!mfaEnabled && !enrollment && (
          <button
            type="button"
            disabled={busy}
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() =>
              void run(async () => {
                const result = await request('/profile/mfa/setup', 'POST')
                if (!result.secret || !result.qrCode)
                  throw new Error(t('Could not start MFA enrollment'))
                setEnrollment({ secret: result.secret, qrCode: result.qrCode })
              })
            }
          >
            {t('Set up MFA')}
          </button>
        )}
        {enrollment && (
          <div className="space-y-3">
            <img
              src={enrollment.qrCode}
              alt={t('Scan this QR code with your authenticator app')}
              className="h-44 w-44"
            />
            <p>
              {t('Or enter this secret manually')}: <code>{enrollment.secret}</code>
            </p>
            <label className="block text-sm">
              {t('Authenticator code')}
              <input
                className="mt-1 block rounded-md border px-3 py-2"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy || !code}
              className="rounded-md border px-3 py-2 text-sm"
              onClick={() =>
                void run(async () => {
                  const result = await request('/profile/mfa/confirm', 'POST', { code })
                  setMfaEnabled(true)
                  setEnrollment(undefined)
                  setCode('')
                  setRecoveryCodes(result.recoveryCodes ?? [])
                })
              }
            >
              {t('Confirm and enable')}
            </button>
          </div>
        )}
        {mfaEnabled && (
          <div className="space-y-3">
            <p>{t('MFA is enabled.')}</p>
            <label className="block text-sm">
              {t('Authenticator code')}
              <input
                className="mt-1 block rounded-md border px-3 py-2"
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy || !code}
              className="rounded-md border px-3 py-2 text-sm"
              onClick={() =>
                void run(async () => {
                  const result = await request('/profile/mfa/recovery-codes', 'POST', { code })
                  setRecoveryCodes(result.recoveryCodes ?? [])
                  setCode('')
                })
              }
            >
              {t('Regenerate recovery codes')}
            </button>
            <label className="block text-sm">
              {t('Current password (or enter an authenticator code above)')}
              <input
                className="mt-1 block rounded-md border px-3 py-2"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy || (!password && !code)}
              className="rounded-md border px-3 py-2 text-sm"
              onClick={() =>
                void run(async () => {
                  await request(
                    '/profile/mfa/disable',
                    'POST',
                    password ? { current_password: password } : { code }
                  )
                  setMfaEnabled(false)
                  setPassword('')
                  setCode('')
                  setRecoveryCodes(undefined)
                })
              }
            >
              {t('Disable MFA')}
            </button>
          </div>
        )}
        {recoveryCodes && (
          <div className="rounded-md border p-4">
            <h4 className="font-medium">{t('Save these recovery codes now')}</h4>
            <p className="text-sm">
              {t('Each code can be used once. They will not be shown again.')}
            </p>
            <ul className="grid grid-cols-2 gap-1 font-mono text-sm">
              {recoveryCodes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-3 underline"
              onClick={() => setRecoveryCodes(undefined)}
            >
              {t('I have saved these codes')}
            </button>
          </div>
        )}
      </section>
      {passkeysEnabled && (
        <section className="space-y-3 border-t pt-5" aria-labelledby="passkeys-heading">
          <h3 id="passkeys-heading" className="font-medium">
            {t('Passkeys')}
          </h3>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="passkey-name">
              {t('Passkey name')}
            </label>
            <input
              id="passkey-name"
              className="rounded-md border px-3 py-2 text-sm"
              placeholder={t('Passkey name')}
              required
              maxLength={100}
              value={passkeyName}
              onChange={(event) => setPasskeyName(event.currentTarget.value)}
            />
            <button
              type="button"
              disabled={busy || !passkeyName.trim()}
              className="rounded-md border px-3 py-2 text-sm"
              onClick={() =>
                void run(async () => {
                  const options = await request('/profile/passkeys/register/options', 'POST')
                  // Keep WebAuthn browser code out of the profile's initial client chunk.
                  const { startRegistration } = await import('@simplewebauthn/browser')
                  const credential = await startRegistration({
                    optionsJSON: options as PublicKeyCredentialCreationOptionsJSON,
                  })
                  await request('/profile/passkeys/register/verify', 'POST', {
                    name: passkeyName,
                    credential,
                  })
                  setPasskeyName('')
                  await refreshPasskeys()
                })
              }
            >
              {t('Register passkey')}
            </button>
          </div>
          <ul className="space-y-2">
            {passkeys.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
                <span className="mr-auto">{item.name ?? t('Passkey')}</span>
                <button
                  type="button"
                  className="underline"
                  disabled={busy}
                  onClick={() => {
                    const name = window.prompt(t('New passkey name'), item.name ?? t('Passkey'))
                    if (name)
                      void run(async () => {
                        await request(`/profile/passkeys/${item.id}`, 'PATCH', { name })
                        await refreshPasskeys()
                      })
                  }}
                >
                  {t('Rename')}
                </button>
                <button
                  type="button"
                  className="text-destructive underline"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(t('Delete this passkey?')))
                      void run(async () => {
                        await request(`/profile/passkeys/${item.id}`, 'DELETE')
                        await refreshPasskeys()
                      })
                  }}
                >
                  {t('Delete')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
export default ProfileSecurity
