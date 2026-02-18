# Changelog

## Unreleased

- Devtools extension now uses runtime content-script injection scoped to active DevTools sessions.
- Bridge now enforces strict same-origin message handling (empty-origin messages are rejected).
- Bridge command execution defaults to dev-only; production requires explicit `commandsEnabled: true`.
- Bridge now fails closed when `NODE_ENV` is unavailable; explicit `enabled: true` is required.
- Bridge docs now align to the current command model (`commandsEnabled` + origin/message validation + rate limits + payload validation).
- Legacy command auth options were removed from bridge API docs in this branch.
- Devtools background now surfaces content-script injection failures to the panel.
- Devtools panel warnings now use structured payloads (`code`, `message`, `recoverable`, `tabId`).
- Browser integration tests now collect trace/video/console diagnostics and enforce non-skip behavior in CI.
- Devtools panel now displays log retention policy and keeps the latest 2000 events per machine.

### Migration Notes

- If you relied on production command execution, pass `commandsEnabled: true` to `attachJourneyDevtools`.
- If your browser build does not expose `process.env.NODE_ENV`, pass `enabled: true` (and `commandsEnabled: true` when needed).
- Legacy command-auth APIs are no longer documented in this branch.
- Use `commandsEnabled` and environment gating for command control.
- If you have test harnesses dispatching synthetic `message` events, include `origin`.

## 0.1.0 - 2026-02-09

- Initial release.
- Declarative graph-based flow model.
- Core machine + React bindings.
- Test suite for core and React integration.
- Documentation and example flows.
