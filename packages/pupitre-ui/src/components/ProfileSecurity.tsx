import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser'
import { t } from '@rikology/pupitre-react'
import { useContext, useEffect, useId, useState } from 'react'
import { Badge, buttonClasses, cn, controlClasses, ledgerRuleClasses } from '../primitives/index.js'
import { Icon } from '../icons.js'
import { ConfirmDialog } from './ConfirmDialog.js'
import { PanelNestingContext } from './Section.js'

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
  const nested = useContext(PanelNestingContext)
  const id = useId()
  const mfaHeadingId = `${id}-mfa-heading`
  const passkeysHeadingId = `${id}-passkeys-heading`
  const passkeyNameId = `${id}-passkey-name`
  const [mfaEnabled, setMfaEnabled] = useState(initialMfaEnabled)
  const [enrollment, setEnrollment] = useState<{ secret: string; qrCode: string }>()
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [passkeyName, setPasskeyName] = useState('')
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Passkey>()

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
    <section
      // Inside the profile form it is a sub-group: a hairline instead of a second ink rule.
      className={cn('space-y-5', nested ? 'mt-3 border-t border-border pt-5' : ledgerRuleClasses)}
      aria-label={t('Account security')}
    >
      <header className={cn(!nested && 'pt-3 pb-4')}>
        <h2 className="text-[0.9375rem] font-semibold">{t('Account security')}</h2>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">
          {t('Manage your authenticator app and passkeys.')}
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="border-y border-border bg-danger-soft px-3 py-2 text-sm text-danger-ink"
        >
          {error}
        </p>
      )}
      <section className="space-y-5" aria-labelledby={mfaHeadingId}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={mfaHeadingId} className="text-[0.9375rem] font-semibold">
            {t('Authenticator app')}
          </h3>
          <Badge
            color={mfaEnabled ? 'success' : 'gray'}
            icon={mfaEnabled ? 'shield-check' : 'shield'}
          >
            {mfaEnabled ? t('Enabled') : t('Not enabled')}
          </Badge>
        </div>
        {!mfaEnabled && !enrollment && (
          <button
            type="button"
            disabled={busy}
            className={buttonClasses({ color: 'primary' })}
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
          <div className="space-y-4">
            <img
              src={enrollment.qrCode}
              alt={t('Scan this QR code with your authenticator app')}
              className="size-44"
            />
            <p className="text-[0.8125rem] text-muted-foreground">
              {t('Or enter this secret manually')}:{' '}
              <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                {enrollment.secret}
              </code>
            </p>
            <label className="block max-w-sm text-sm font-medium">
              {t('Authenticator code')}
              <input
                className={`${controlClasses} mt-1.5 block h-(--control-h) px-3`}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy || !code}
              className={buttonClasses({ color: 'primary' })}
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
          <div className="space-y-4">
            <p className="text-[0.8125rem] text-muted-foreground">{t('MFA is enabled.')}</p>
            <label className="block max-w-sm text-sm font-medium">
              {t('Authenticator code')}
              <input
                className={`${controlClasses} mt-1.5 block h-(--control-h) px-3`}
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy || !code}
              className={buttonClasses({ color: 'gray' })}
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
            <label className="block max-w-sm text-sm font-medium">
              {t('Current password (or enter an authenticator code above)')}
              <input
                className={`${controlClasses} mt-1.5 block h-(--control-h) px-3`}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy || (!password && !code)}
              className={buttonClasses({ color: 'danger', variant: 'outline' })}
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
          <div className="space-y-3 border-t border-border pt-5">
            <h4 className="text-sm font-semibold">{t('Save these recovery codes now')}</h4>
            <p className="text-[0.8125rem] text-muted-foreground">
              {t('Each code can be used once. They will not be shown again.')}
            </p>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-2 font-mono text-sm tabular-nums sm:grid-cols-2">
              {recoveryCodes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClasses({ size: 'sm' })}
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(recoveryCodes.join('\n'))
                  })
                }
              >
                <Icon name="copy" className="size-4" />
                {t('Copy')}
              </button>
              <button
                type="button"
                className={buttonClasses({ size: 'sm' })}
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([recoveryCodes.join('\n')], { type: 'text/plain' })
                  )
                  const link = document.createElement('a')
                  link.href = url
                  link.download = 'recovery-codes.txt'
                  link.click()
                  URL.revokeObjectURL(url)
                }}
              >
                <Icon name="download" className="size-4" />
                {t('Download')}
              </button>
            </div>
            <button
              type="button"
              className={buttonClasses({ variant: 'link' })}
              onClick={() => setRecoveryCodes(undefined)}
            >
              {t('I have saved these codes')}
            </button>
          </div>
        )}
      </section>
      {passkeysEnabled && (
        <section
          className="space-y-4 border-t border-border pt-5"
          aria-labelledby={passkeysHeadingId}
        >
          <div className="space-y-4">
            <h3 id={passkeysHeadingId} className="text-[0.9375rem] font-semibold">
              {t('Passkeys')}
            </h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="sr-only" htmlFor={passkeyNameId}>
                {t('Passkey name')}
              </label>
              <input
                id={passkeyNameId}
                className={`${controlClasses} h-(--control-h) px-3 sm:flex-1`}
                placeholder={t('Passkey name')}
                required
                maxLength={100}
                value={passkeyName}
                onChange={(event) => setPasskeyName(event.currentTarget.value)}
              />
              <button
                type="button"
                disabled={busy || !passkeyName.trim()}
                className={buttonClasses({ color: 'primary' })}
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
          </div>
          {passkeys.length === 0 && (
            <p className="text-[0.8125rem] text-muted-foreground">{t('No passkeys registered.')}</p>
          )}
          <ul className="divide-y divide-border">
            {passkeys.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 py-3">
                <Icon name="fingerprint" className="size-4 text-muted-foreground" />
                <span className="mr-auto text-sm font-medium">{item.name ?? t('Passkey')}</span>
                <button
                  type="button"
                  className={buttonClasses({ variant: 'ghost', size: 'sm' })}
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
                  className={buttonClasses({
                    color: 'danger',
                    variant: 'ghost',
                    size: 'sm',
                    square: true,
                  })}
                  aria-label={t('Delete')}
                  disabled={busy}
                  onClick={() => setPendingDelete(item)}
                >
                  <Icon name="trash-2" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <ConfirmDialog
            open={pendingDelete !== undefined}
            heading={t('Delete this passkey?')}
            description={t('You will no longer be able to sign in with it.')}
            submitLabel={t('Delete')}
            destructive
            loading={busy}
            onConfirm={() => {
              const target = pendingDelete
              if (!target) return
              void run(async () => {
                await request(`/profile/passkeys/${target.id}`, 'DELETE')
                await refreshPasskeys()
              }).then(() => setPendingDelete(undefined))
            }}
            onCancel={() => setPendingDelete(undefined)}
          />
        </section>
      )}
    </section>
  )
}
export default ProfileSecurity
