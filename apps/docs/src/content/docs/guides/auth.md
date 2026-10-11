---
title: Authentication
sidebar:
  order: 11
---

Pupitre uses the host authentication guard. `.guard('web')` selects a guard; `.login()` enables Pupitre's login/logout routes. If using existing host auth, leave login disabled and register appropriate panel middleware.

```ts
.login().registration().passwordReset().emailVerification()
.profile({ avatar: true })
.mfa({ required: true, issuer: 'My administration' })
.passkeys()
.social({ providers: ['github', 'google'], registration: false })
```

## Host model and configuration

Set `auth.model: () => import('#models/user')` in `defineConfig`. Map `auth.columns` by **model attribute name**: defaults include fullName, email, password, avatar, emailVerifiedAt, timezone, currentTenantId, mfaSecret, mfaRecoveryCodes, mfaEnabledAt, provider and providerId. Match generated migrations to your model and app.

`passwordResetTtl` defaults to 60 minutes. Reset and email verification require a working mail adapter. Avatar upload uses the configured storage disk. Enable registration only if creating users from this panel is appropriate for your deployment.

Avatar uploads are limited to **5 MiB**. The server checks actual file bytes and accepts only passive images; SVG, HTML/XHTML and JavaScript are rejected regardless of a browser-supplied filename or MIME type.

## Rate limits

Login, passkey sign-in options/verification and social callbacks each have a **60-request/minute IP/panel quota**, including successful sign-ins so shared office/NAT IPs remain usable. Password login additionally has a **5-attempt/minute per-email+IP failure window**: successful credential verification clears that window, but does not clear the endpoint/IP quota. Changing email addresses cannot bypass the IP quota while its key remains stored. Reset request/consume, registration, email resend, MFA setup/confirm and passkey registration use **5 attempts/minute**; MFA challenge/recovery/disable retain their user attempt budget.

Throttled JSON callers receive HTTP 429 and `Retry-After: 60`. HTML/Inertia forms use their normal redirect-back field-error/toast protocol with the same retry header, rather than a raw JSON modal.

Install and configure a shared-store `@adonisjs/limiter` for multi-worker or multi-instance deployments. Without it, auth uses a per-process in-memory fallback capped at 10,000 keys. At capacity it evicts the oldest key in insertion order so new identities can sign in; heavy identity churn can therefore forget an active quota before its window expires. Restarts also reset this fallback. Use a shared store for strong enforcement under churn. An installed limiter failure is not silently ignored. Configure the host's trusted proxies so the request IP represents the real caller, and apply equivalent limits to any custom host login routes.

## MFA

`.mfa()` enables TOTP enrollment, challenge and one-use recovery codes. `{ required: true }` requires enrollment; `issuer` labels authenticator entries. Protect encrypted secrets and recovery-code persistence with your host configuration. Email-code MFA is intentionally not implemented.

## Passkeys

`.passkeys()` enables WebAuthn profile registration/management and usernameless sign-in. Configure `auth.passkeys: { rpId, origin, rpName }` for the real deployment hostname/origin. WebAuthn needs an appropriate secure browser context. A successful passkey assertion satisfies the MFA challenge.

## Social sign-in

Install/configure Ally in your host and select actual configured provider names. Pupitre uses provider identity, verified-email fallback and an MFA-aware callback. Social registration defaults to false and can be explicitly enabled. Do not assume unverified provider email is sufficient to link an existing privileged account.

Disable features by passing false (`mfa(false)`, `passkeys(false)`, `profile(false)`) or an empty social provider list. These are server configuration choices, not frontend-only switches.
