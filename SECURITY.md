# Security Policy

Please report security issues privately.

## Supported Versions

Security fixes land on the latest minor of the current major line. Pre-1.0 release candidates are
not supported: upgrade to 1.0 or later.

| Version      | Supported                         |
| ------------ | --------------------------------- |
| `1.x`        | Yes — latest minor receives fixes |
| `1.0.0-rc.*` | No — superseded by `1.0.0`        |
| `< 1.0.0`    | No                                |

This covers `@rxova/journey-core`, `@rxova/journey-react`, and `@rxova/journey-devtools-bridge`.
The DevTools browser extension is supported at its current published version only.

## Response Targets

This is a volunteer-maintained project, so these are goals rather than contractual guarantees:

- Acknowledgement within 5 business days.
- An initial assessment, including whether the report is accepted, within 10 business days.
- Fixes for accepted high-severity reports released as soon as practical, coordinated with the
  reporter before public disclosure.

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
