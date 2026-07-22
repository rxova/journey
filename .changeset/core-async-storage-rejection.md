---
"@rxova/journey-core": patch
---

The persistence plugin no longer leaks an unhandled rejection when an async storage adapter fails.
`JourneyStorage.setItem` is declared as `void | Promise<void>` so adapters can be asynchronous, but
the plugin discarded the returned promise with `void` — a rejecting adapter therefore produced an
unhandled rejection, which terminates the process under Node's default
`--unhandled-rejections=throw`.

The write is now contained and routed to the listener-error reporter, matching how a synchronous
`setItem` throw was already isolated. Autosave was never affected: it awaits inside a `try/catch`
and surfaces failures through its own state.

Reporting is still coarse — persistence has no error channel of its own, so a failed write is
observable only through the reporter, and `lastSavedAt` continues to advance. A dedicated
persistence error state is planned separately.
