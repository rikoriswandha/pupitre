import { AuthShell } from '../../../src/components/AuthShell.js'

export function AuthShellStory() {
  return (
    <AuthShell
      panel={{
        id: 'admin',
        path: '/admin',
        brand: { name: 'Pupitre Editorial' },
        theme: {},
        features: {
          login: true,
          registration: true,
          passwordReset: true,
          emailVerification: false,
          profile: true,
          tenancy: false,
          notifications: false,
          globalSearch: false,
        },
      }}
      title="Sign in"
    >
      <form aria-label="Sign in form">
        <label htmlFor="auth-email">Email</label>
        <input id="auth-email" type="email" />
        <button type="submit">Continue</button>
      </form>
    </AuthShell>
  )
}
