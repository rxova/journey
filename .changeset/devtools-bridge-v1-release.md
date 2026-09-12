---
"@rxova/journey-devtools-bridge": major
---

Replace the command-specific `1.0.0-rc.2` bridge with protocol v7 and align it with the final Core
snapshot and machine contracts.

- Register machine capabilities as generic feature and operation descriptors. Each operation
  declares its id, label, description, mutation flag, output kind, and typed input fields; invocation
  returns a structured snapshot, data, text, or void result, or a serialized operation error.
- Expose lifecycle, navigation, context patching, snapshot inspection, and graph event dispatch as
  standard operation descriptors. Graph machines are detected by the presence of `send`, and
  `eventTypes` can advertise the complete declared event set to the panel.
- Replace `commandsEnabled` with `mutationsEnabled`. Mutating operations currently default to
  enabled whenever the bridge itself is enabled; set this option to `false` to expose read-only
  inspection. Add configurable operation rate limiting, defaulting to 100 operations per 10
  seconds. Remove the old `pluginMetadata` option; plugin state now travels through the machine
  snapshot.
- Update transported snapshots to the Core V1 shape: the linear/graph discriminator, timeline
  history, current-step async state, namespaced plugin state, outcomes, and enabled graph events are
  preserved instead of translated into the legacy computed shape. Nested runtime errors are
  serialized with their name, message, stack, and cause instead of collapsing to empty objects.
- Emit protocol version 7. Version 6 invoke envelopes remain accepted because their generic invoke
  shape is identical; version 5 register traffic is tolerated for discovery but cannot invoke v7
  operations.
- Harden the window boundary with source, origin, channel, version, payload depth, and payload size
  validation. Reject unknown operations, invalid inputs, disabled mutations, rate-limit excess, and
  stale post-detach traffic with structured operation errors where applicable.
- Handle replay requests directly in each attached bridge, support multiple machines, and isolate
  bridge subscription failures from machine transitions.
- Export `buildOperationRunners`, `createJourneyMachineId`, `OperationRateLimiter`,
  `serializeSnapshot`, protocol guards/constants, and the full protocol descriptor/envelope types.
- Add an explicit `engines.node >=20.11.0` package requirement.
- Rewrite the bridge documentation and generated API reference for protocol v7.

Consumers with a custom panel or protocol client must migrate from legacy command envelopes and the
old computed snapshot shape to generic `invoke` / `operationResult` / `operationError` envelopes.
