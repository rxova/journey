---
"@rxova/journey-core": minor
---

Harden the three plugin boundaries the runtime did not isolate.

**A throwing `setup()` no longer strands the plugins registered before it.** Plugin setup ran
unguarded, so a failure part-way through the tuple left earlier plugins already subscribed and
holding `onDispose` callbacks — while the machine was never returned, making `dispose()` unreachable
and their timers and subscriptions permanent. Construction still fails, but teardown now runs first.
The same applies when a duplicate plugin name is rejected.

**A throwing `deriveSnapshot` no longer bricks the machine.** Derivers run on every publish and in
the constructor, and were the only plugin entry point with no isolation — one bad third-party plugin
took down every transition. Failures now route through `onListenerError` like any other plugin tap,
and the plugin's previous snapshot slice is carried forward so consumers reading
`snapshot.plugins[name]` do not see it blink to `undefined`. Other plugins' slices are unaffected.

**`createExecutionPathsPlugin` is bounded.** `completedPaths` was the one plugin buffer with no cap:
a machine that completes and restarts on a loop retained one frozen array per run for the lifetime
of the process. It now takes `maxPaths` (default 50, newest kept) and exposes `clearCompletedPaths()`.
`getCurrentPath()` is still unbounded within a single run, matching the history timeline's documented
1.0 behaviour.

**Blocked `localStorage` access reports as a journey error.** Reading `globalThis.localStorage` can
throw rather than return `undefined` — a third-party iframe with storage blocked, or Safari's
Lockdown Mode — which surfaced as a raw `SecurityError` out of `createLinearJourney` and read as a
library crash. It is now a `journey:` error naming the fix, carrying the original as `cause`.
Persistence still fails loudly rather than silently disabling itself, since a silent downgrade loses
data with no signal.

The two isolation guards sit on the core path, so both factories grew slightly: `createLinearJourney`
by 23 B and `createGraphJourney` by 38 B minified+Brotli. Their size budgets moved to 5.7 kB and
5.9 kB.
