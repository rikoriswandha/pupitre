# Changelog

## Unreleased (milestone M4)

- Add `transmitRealtime()` with panel-guard, user identity, tenant membership, and resource policy channel authorization.
- Add SSR-safe `transmitRealtimeClient()` at `/client`, shared subscriptions, catalog payload validation, and Shield XSRF request headers.
- Security (WP42): add malformed-channel and guard-principal/tenant isolation regressions alongside subscribe/unsubscribe XSRF coverage.
- M4 review: reuse core channel patterns and panel guard helper; accept only namespaced `pupitre:notification` and `pupitre:table` wire pings.
