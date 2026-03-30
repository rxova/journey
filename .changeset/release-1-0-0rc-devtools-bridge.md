---
"@rxova/journey-devtools-bridge": major
---

## Breaking changes

### Protocol v4

The bridge now communicates over protocol v4 envelopes with capability metadata, observation
events, and execution-path queries.

### Aligned with the new core API

The bridge now targets `createJourneyMachine()`, the simplified `JourneyDefinition` generics, and
the plugin-based core architecture.

## Added

### Legacy v3 compatibility

Incoming `register` envelopes without capability metadata are still accepted so extension-first
rollouts can interoperate with older inspected apps.

### Observation event envelopes

The bridge can forward `JourneyObservationEvent` payloads to power transition tracing and async
state inspection in devtools.

### Execution-path query envelopes

The extension can request execution-path enumeration when the inspected machine has the
execution-paths plugin registered.

## Changed

- Kept compatibility with the core timeout, constant-removal, and internal runtime refactors
