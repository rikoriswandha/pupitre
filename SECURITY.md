# Security policy

## Supported versions

Security fixes are supported for the latest released **1.x** version of Pupitre and its first-party packages. Upgrade to the latest 1.x patch before reporting a suspected issue. Older prereleases and other major versions are not supported.

## Reporting a vulnerability

Please do not disclose vulnerabilities through public issues or pull requests. Use GitHub's private vulnerability reporting for **rikoriswandha/pupitre**:

https://github.com/rikoriswandha/pupitre/security/advisories/new

Include affected package versions, a minimal reproduction, the impact and required privileges, and any suggested mitigation. Remove real credentials, personal data, and production database contents from attachments. We will investigate privately and coordinate a fix and advisory with the reporter. Please allow maintainers time to assess and patch the issue before public disclosure.

## Deployment responsibilities

Hosts must enable AdonisJS Shield CSRF protection for all cookie-authenticated mutations, enforce a CSP without `unsafe-eval`, configure trusted upload storage and size limits, and install/configure the auth rate-limiter adapter. Do not expose development seed credentials or use development security settings in production. Review authorization policies, tenant membership checks, and plugin permissions for the host application's data model.
