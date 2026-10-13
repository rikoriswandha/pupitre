import { useEffect, useId, useState } from 'react'
import { t } from '@rikology/pupitre-react'
import { buttonClasses, cn, controlClasses } from '../primitives/index.js'

type Session = {
  id: string
  browser: string
  device: string
  ip: string
  lastActiveAt: string
  current: boolean
}
type Event = { event: string; method: string | null; ip: string; created_at: string }
export type ProfileSessionsProps = {
  basePath: string
  hasPassword: boolean
  passkeysEnabled: boolean
  history: boolean
}
export function ProfileSessions({
  basePath,
  hasPassword,
  passkeysEnabled,
  history,
}: ProfileSessionsProps) {
  const id = useId()
  const [sessions, setSessions] = useState<Session[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function request(path: string, method = 'GET', body?: unknown) {
    const csrf = document.cookie
      .split('; ')
      .find((part) => part.startsWith('XSRF-TOKEN='))
      ?.slice(11)
    const response = await fetch(`${basePath}/profile/sessions${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': csrf ? decodeURIComponent(csrf) : '',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.message ?? t('The request failed'))
    }
    return response.status === 204 ? {} : response.json()
  }
  async function refresh() {
    const result = await request('')
    setSessions(result.sessions)
    setEvents(result.events)
  }
  useEffect(() => {
    let active = true
    void fetch(`${basePath}/profile/sessions`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(t('The request failed'))
        const result = await response.json()
        if (active) {
          setSessions(result.sessions)
          setEvents(result.events)
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message)
      })
    return () => {
      active = false
    }
  }, [basePath])
  async function run(operation: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await operation()
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('The request failed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="mt-8 space-y-6" aria-label={t('Browser sessions')}>
      <h2 className="text-base font-semibold">{t('Browser sessions')}</h2>
      {error && (
        <p role="alert" className="text-sm text-danger-ink">
          {error}
        </p>
      )}
      <ul className="divide-y divide-border" aria-label={t('Browser sessions')}>
        {sessions.map((session) => (
          <li
            key={session.id}
            data-session-id={session.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div className="space-y-1 text-sm">
              <p>
                {session.browser} · {session.device}{' '}
                {session.current && <strong>{t('Current session')}</strong>}
              </p>
              <p className="text-muted-foreground">
                {session.ip} · {t('Last active')}: {new Date(session.lastActiveAt).toLocaleString()}
              </p>
            </div>
            {!session.current && (
              <button
                type="button"
                disabled={busy}
                className={buttonClasses({ color: 'danger', variant: 'outline' })}
                onClick={() =>
                  void run(async () => {
                    await request(`/${session.id}`, 'DELETE')
                  })
                }
              >
                {t('Revoke session')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {hasPassword && (
        <label htmlFor={`${id}-password`} className="block text-sm">
          {t('Current password')}
          <input
            id={`${id}-password`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            className={cn(controlClasses, 'mt-2 block h-(--control-h) max-w-sm px-3')}
          />
        </label>
      )}
      {hasPassword || passkeysEnabled ? (
        <button
          type="button"
          disabled={busy || (hasPassword && !password)}
          className={buttonClasses({ color: 'gray' })}
          onClick={() =>
            void run(async () => {
              let body: unknown = { current_password: password }
              if (!hasPassword) {
                const optionsJSON = await request('/passkey-options', 'POST')
                const { startAuthentication } = await import('@simplewebauthn/browser')
                body = { credential: await startAuthentication({ optionsJSON }) }
              }
              await request('/logout-others', 'POST', body)
              setPassword('')
            })
          }
        >
          {t('Log out other browser sessions')}
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('Set a password or enable passkeys to log out other browser sessions.')}
        </p>
      )}
      {history && (
        <section className="space-y-3 border-t border-border pt-5" aria-label={t('Recent logins')}>
          <h2 className="text-base font-semibold">{t('Recent logins')}</h2>
          <ul className="space-y-2 text-sm">
            {events.map((event, index) => (
              <li key={index}>
                {eventLabel(event.event)}
                {event.method ? ` · ${methodLabel(event.method)}` : ''} · {event.ip} ·{' '}
                {new Date(event.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}

function eventLabel(event: string) {
  switch (event) {
    case 'login':
      return t('Signed in')
    case 'logout':
      return t('Signed out')
    case 'failed':
      return t('Failed sign-in')
    case 'mfa_failed':
      return t('Failed MFA challenge')
    case 'session_revoked':
      return t('Session revoked')
    case 'impersonation_started':
      return t('Impersonation started')
    case 'impersonation_stopped':
      return t('Impersonation stopped')
    default:
      return event
  }
}

function methodLabel(method: string) {
  switch (method) {
    case 'password':
      return t('Password')
    case 'passkey':
      return t('Passkey')
    case 'social':
      return t('Social login')
    case 'mfa':
      return t('Authenticator app')
    case 'remember':
      return t('Remember me')
    case 'impersonation':
      return t('Impersonation')
    default:
      return method
  }
}
