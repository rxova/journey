---
"@rxova/journey-core": patch
---

Scope the replay, autosave, and analytics plugins' per-instance state to `setup()`.

These three plugins previously held their mutable state (replay buffer, autosave debounce timer /
pending save / status, analytics ring buffer and event subscription) in the plugin **factory closure**
instead of inside `setup()`. Because `setup()` runs once per machine but the factory closure is created
once per plugin instance, reusing a single plugin instance across machines — which is exactly what
`createJourneyFactory` does for its independent runtimes — caused those machines to **share** that
state: merged replay sessions, a shared autosave timer/status, a shared analytics buffer, and a leaked
analytics event subscription (disposing one machine tore down another's).

State now lives inside `setup()` (mirroring the `persistence` plugin), so each machine gets its own,
and a single plugin instance is safe to reuse across machines. No API, type, or behavior change for the
common one-machine case. The plugin-authoring docs now document this contract for third-party plugins.
