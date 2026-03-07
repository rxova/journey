---
"@rxova/journey-devtools-bridge": minor
---

## What changed

- Snapshot delivery is now coalesced to one animation frame, with a timeout fallback when `requestAnimationFrame` is unavailable. This reduces burst traffic when machines update rapidly.
- Pending scheduled snapshots are canceled on detach, so the bridge no longer emits stale state after teardown or disconnect.
- Command results now preserve the core runtime's non-throwing failure model by returning serialized `error` data inside normal `commandResult` envelopes instead of treating every failed transition as a transport exception.
- Environment detection is broader and safer. The bridge now prefers `import.meta.env.DEV` / `import.meta.env.PROD`, falls back to `process.env.NODE_ENV`, and defaults to disabled when neither signal exists.
- That environment change makes Bun-based and browser-first bundler setups behave more predictably without assuming a Node-style runtime.
- Serialization and protocol validation were hardened. Payloads are cloned and sanitized more defensively, validation now does a single size check plus a structural safety walk, and unsafe, circular, or oversized payloads are rejected more consistently.
- Internal bridge logic was cleaned up to remove duplication in an already environment-sensitive codepath, reducing the chance of behavior drift between similar branches.
- README, docs, and security guidance were updated with Bun install notes, explicit enablement guidance for runtimes without env signals, and CSP expectations for browser apps using the bridge.
- Test coverage was expanded around protocol safety, serialization edge cases, bridge detach behavior, and command/result handling.

## Breaking changes

- Protocol payload validation is stricter. Consumers relying on previously accepted oversized, circular, or structurally unsafe payloads may now see those envelopes rejected.
