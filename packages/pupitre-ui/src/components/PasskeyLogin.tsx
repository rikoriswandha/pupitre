import { useState } from 'react'
import { t } from '@rikology/pupitre-react'
import { Button } from '../primitives/index.js'
import { Icon } from '../icons.js'

function xsrfToken() {
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='))
  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : ''
}

export function PasskeyLogin({ panelPath }: { panelPath: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function signIn() {
    setBusy(true)
    setError('')
    try {
      const optionsResponse = await fetch(`${panelPath}/passkeys/login/options`, {
        credentials: 'same-origin',
      })
      if (!optionsResponse.ok) throw new Error(t('Unable to start passkey sign-in'))
      const options = await optionsResponse.json()
      // The optional WebAuthn browser peer stays out of the initial auth bundle.
      const { startAuthentication } = await import('@simplewebauthn/browser')
      const credential = await startAuthentication({ optionsJSON: options })
      const result = await fetch(`${panelPath}/passkeys/login/verify`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': xsrfToken(),
        },
        body: JSON.stringify({ credential }),
      })
      if (!result.ok) {
        const body = (await result.json()) as { message?: string }
        throw new Error(body.message ?? t('Passkey sign-in failed'))
      }
      window.location.assign(panelPath)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Passkey sign-in failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>{t('or')}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        onClick={signIn}
        disabled={busy}
        color="gray"
        loading={busy}
        className="w-full"
      >
        {!busy && <Icon name="fingerprint" className="size-4" />}
        {busy ? t('Waiting for passkey…') : t('Sign in with a passkey')}
      </Button>
      {error && (
        <p className="mt-2 text-[0.8125rem] text-danger-ink" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
