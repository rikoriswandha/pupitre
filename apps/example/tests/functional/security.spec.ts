import { test } from '@japa/runner'
import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

const mutatingMethods: Record<string, true> = { POST: true, PUT: true, PATCH: true, DELETE: true }

// No mutating route is exempt. Transmit's SSE stream is GET, not a CSRF exemption.
test('every registered mutating route rejects missing and invalid XSRF tokens', async ({
  assert,
}) => {
  const address = server.getNodeServer()!.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP test server')
  const host = address.address.includes(':') ? `[${address.address}]` : address.address
  const baseUrl = `http://${host}:${address.port}`
  const routes = Object.values(router.toJSON()).flat()
  const audited: string[] = []
  for (const route of routes) {
    for (const method of route.methods) {
      if (!mutatingMethods[method]) continue
      const path = route.pattern
        .replace(/:([\w]+)\??/g, (_match, name: string) =>
          name.toLowerCase().includes('tenant') ? 'acme' : '1'
        )
        .replace(/\*/g, 'security-audit')
      for (const token of [undefined, 'invalid-security-audit-token']) {
        const response = await fetch(`${baseUrl}${path}`, {
          method,
          redirect: 'manual',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { 'X-XSRF-TOKEN': token } : {}),
          },
          body: '{}',
        })
        const body = await response.text()
        assert.equal(response.status, 403, `${method} ${route.pattern}: ${body}`)
        assert.match(
          body,
          /E_BAD_CSRF_TOKEN|Invalid CSRF token|csrf/i,
          `${method} ${route.pattern}`
        )
      }
      audited.push(`${method} ${route.pattern}`)
    }
  }
  assert.isAbove(audited.length, 0)
  assert.isTrue(audited.some((route) => route.includes('__transmit/subscribe')))
  assert.isTrue(audited.some((route) => route.includes('__transmit/unsubscribe')))
  assert.isTrue(audited.some((route) => route.includes('roles')))
  const inertiaResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Accept': 'text/html', 'X-Inertia': 'true', 'Content-Type': 'application/json' },
    body: '{}',
  })
  assert.equal(inertiaResponse.status, 403)
  assert.equal(inertiaResponse.headers.get('x-inertia'), 'true')
  const page = (await inertiaResponse.json()) as { component: string }
  assert.equal(page.component, 'errors/csrf_expired')
  console.log(
    `CSRF audit: ${audited.length} mutating method/routes; no exemptions\n${audited.join('\n')}`
  )
}).timeout(120_000)
