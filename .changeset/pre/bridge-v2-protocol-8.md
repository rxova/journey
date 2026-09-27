---
"@rxova/journey-devtools-bridge": major
---

Protocol v8. The serialized snapshot's `machine` object narrows to `{ outcome }`: the six derived
booleans it used to carry — `isLoading`, plus one per status — each restated `status` or
`transition.pending`, and no panel ever read them.

The supported version window shifts to 8 / 7 / 6. A v7 emitter stays supported and can still drive
mutations; v6 becomes read-only; v5 is no longer supported.

The `"headless"` machine mode is retired from `isMachineMeta`, as its own TODO asked. `mode` is
`snapshot.type` and has only been `"linear" | "graph"` since the mode left
`JourneyDevtoolsMachineMeta`.
