---
"@rxova/journey-core": minor
---

Persistence reports write failures, and its parser is now total.

**The "saved" indicator no longer lies.** `lastWritten` was assigned _before_ the write was
attempted, so a `QuotaExceededError` — or any failing adapter — left `inspectPersistedState()`
returning a record that never reached storage while `lastSavedAt` advanced. A UI bound to that
showed "Saved" as data was silently dropped. State now moves only on a confirmed write, and the
plugin exposes `getPersistenceState(): { lastSavedAt, error }`, mirroring `AutosaveState`. The
snapshot slice at `snapshot.plugins.persistence` gains the same `error` field.

**Plugins can report their own asynchronous failures.** `PluginHost` gains `reportError(error)`,
which routes to the machine's `onListenerError`. A tap that throws synchronously was already
isolated and reported, but work outliving the tap — an awaited storage write, a debounced flush —
had to choose between an unhandled rejection and a `console.error` that ignored the configured
reporter. Persistence now uses it, so async write failures reach the same place as every other
subscriber failure. Adding a host tap is a compatible change under the plugin contract.

**`parsePersistedState` validates everything it claims to.** It checked that `status` was _a_
string, not that it was a real lifecycle status, and that `timeline` was _an_ array, not that it
held strings — while typing the result as `JourneyPersistedState` and handing it to callers through
the public `readPersisted()`. It now checks the status against the known set, requires string
timeline entries, requires an integer `currentIndex` and a finite `savedAt`, and returns a rebuilt
record rather than the parsed object.

**Restored contexts are scrubbed of prototype-poisoning keys.** `JSON.parse` creates `__proto__` as
an ordinary own property, so a parsed payload is safe in isolation — but stops being safe the moment
application code spreads or `Object.assign`s it, which copies the own key as a _prototype
assignment_. Storage is attacker-reachable, so `__proto__`, `constructor`, and `prototype` are now
dropped from restored context values at every depth.

A `validate`/`migrate` callback for versioning persisted shapes is **not** included: it is a public
API addition that deserves a deliberate design pass rather than being folded into a hardening
change.

Size cost, minified+Brotli: `createPersistencePlugin` +154 B and `createAutosavePlugin` +58 B. The
factories grew too — `createLinearJourney` +161 B, `createGraphJourney` +117 B — because both import
`readRestorableState` statically, so the parser ships whether or not `persist` is used. Budgets were
raised to match; that is the deliberate price of validating attacker-reachable input.
