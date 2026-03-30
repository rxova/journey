---
"apps-devtools": major
---

Upgrade the devtools app for the 1.0 RC release and bridge protocol v4 rollout.

### Added

- Capability-aware controls that adapt to the inspected machine's registered plugins
- Execution-path query support when the inspected machine has the plugin registered
- Observation timeline events for transition tracing and async-state inspection
- OS / DevTools theme following

### Changed

- Accepts legacy protocol v3 bridge envelopes during extension-first rollouts
- Keeps package versions aligned with the updated core and bridge releases
- Replaced store ternary lookup with kind-based envelope lookup

### Fixed

- Protocol version mismatch handling
