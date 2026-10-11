import { useState } from 'react'
import { t } from '@rikology/pupitre-react'

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
    <div className="mt-5 border-t border-border pt-5">
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="flex min-h-10 w-full items-center justify-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
      >
        {busy ? t('Waiting for passkey…') : t('Sign in with a passkey')}
      </button>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
