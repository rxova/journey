---
"@rxova/journey-core": major
---

## Breaking changes

### `JourneyDefinition` simplified from 6 to 4 generic parameters

The separate event-type and payload-map generics are now represented by a single `TEventMap`
record, and the extra step generic has been removed.

### Declarative transitions replace the old builder exports

`tx()`, `createTransitions()`, and `createTypedTransitionHelpers()` are gone from the public API.
Transitions now use declarative graph syntax or linear syntax.

### Explicit machine lifecycle with `machine.start()`

Machines are created in the `"idled"` state and must be started explicitly. `resetJourney()`
returns the machine to `"idled"`.

### Renamed public API surface

- `createMachine()` -> `createJourneyMachine()`
- `resetMachine()` -> `resetJourney()`
- `Machine` -> `JourneyMachine`

### Core features extracted into plugins

Persistence and execution-path enumeration are no longer built into the base machine. Register
plugins explicitly instead.

### Exported runtime constants removed

`JOURNEY_STATUS`, `JOURNEY_EVENT`, `JOURNEY_ASYNC_PHASE`, and `JOURNEY_WILDCARD` are no longer
exported. Use the corresponding string literal types instead.

### Status and observation event names aligned to past tense

Status values now use names such as `"completed"` and `"terminated"`.

## Added

### `createJourneyBuilder`

A per-step graph builder API that compiles to the same `JourneyDefinition` accepted by
`createJourneyMachine()` and `createJourney()`.

### First-party plugins

- Analytics
- Autosave
- Diagnostics
- Execution paths
- Persistence
- Replay

### `goToStepById` is now mode-aware

In headless mode it performs caller-driven navigation. In graph or linear mode it follows declared
transitions like any other event.

### `onEnter` / `onLeave` lifecycle callbacks

Step definitions can now declare observational enter/leave callbacks.

### `timeoutMs` on transitions

Async guards and effects can now time out independently, fail cleanly, and emit the normal
transition failure path.

## Changed

- `updateContextQueued()` has been removed; use `updateContext()` instead
- Internal machine logic was split into smaller runtime, navigation, async-state, control, and send modules
