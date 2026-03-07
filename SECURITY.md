# Security Policy

Please report security issues privately.

## How To Report

Use one of the following:

- Email: rxova@proton.me
- [GitHub Security Advisory form](https://github.com/rxova/journey/security/advisories/new)

If the advisory link is unavailable, use email.

Include:

- affected version
- minimal reproduction
- impact assessment

Public disclosure should happen after a fix is available.

## Application Hardening

If you use `@rxova/journey-devtools-bridge` in a browser app, keep a strict Content Security Policy.

- The bridge uses `window.postMessage` and does not require `unsafe-inline`, `unsafe-eval`, remote script hosts, or `chrome-extension:` / `moz-extension:` sources in `script-src`.
- Prefer nonces or hashes for any inline bootstrap code instead of weakening the entire policy.
- Package-specific guidance lives in [`packages/devtools-bridge/SECURITY.md`](packages/devtools-bridge/SECURITY.md).
