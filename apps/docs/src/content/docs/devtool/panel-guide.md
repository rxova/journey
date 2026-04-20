---
title: "Panel Guide"
---

## Timeline Inspector

The panel uses a Redux-style inspector layout:

- Left side: timeline rows, one per bridge event received.

| Kind     | Badge  | Label pattern                                    | Appears when                        |
| -------- | ------ | ------------------------------------------------ | ----------------------------------- |
| init     | `INIT` | `@@INIT`                                         | Machine registers                   |
| snapshot | `SNAP` | `SNAPSHOT/<stepId>`                              | State snapshot received             |
| command  | `CMD`  | `COMMAND/<type>` or `COMMAND_RESULT/<requestId>` | Mutating command completes          |
| query    | `QRY`  | `QUERY/getExecutionPaths` or `QUERY/<requestId>` | Execution paths result received     |
| event    | `EVT`  | `EVENT/<type>`                                   | Observation event envelope received |
| error    | `ERR`  | `ERROR/<type>` or `ERROR/<requestId>`            | Command or query error              |

- Right side: tabs for `Action`, `State`, and `Diff`.
- Selection is local/read-only and does not mutate inspected runtime state.

### Badge Abbreviations

| Badge  | Meaning                  |
| ------ | ------------------------ |
| `INIT` | Machine registered       |
| `SNAP` | Snapshot update          |
| `CMD`  | Command result           |
| `QRY`  | Query result (read-only) |
| `EVT`  | Observation event        |
| `ERR`  | Error                    |

## Timeline Controls

- **Follow latest**: keeps selection pinned to newest row.
- **Display limit**: limits rows rendered in the panel.
- **Prune to limit**: truncates retained rows for the active machine.

## Capabilities

When a machine is selected, the panel shows a Capabilities row with four badges:

| Badge           | Active                                   | Inactive              |
| --------------- | ---------------------------------------- | --------------------- |
| Observe         | `Observe`                                | `No Events`           |
| Commands        | `Commands <N>` (mutating commands count) | `Commands Off`        |
| Execution Paths | `Execution Paths`                        | `No Execution Paths`  |
| Persistence     | `Persistence`                            | `No Persistence Meta` |

The Commands count excludes `getExecutionPaths`, which is a read-only query. When a persistence plugin is configured, the panel also shows the persistence key and `clearOnReset` setting below the badges.

## Command Controls

Built-ins:

- `startJourney`, `goToNextStep`, `terminateJourney`, `completeJourney`, `resetJourney`
- `goToStepById`
- `goToPreviousStep`
- `goToLastVisitedStep`
- custom `send`
- `clearStepError`
- `getExecutionPaths` (read-only query; accepts optional `maxDepth` and `maxPaths` limits)

## Timeline Retention

The panel retains at most **2000 entries per machine**. When the cap is reached, the oldest entries are dropped automatically. The **Prune to limit** button explicitly truncates the retained rows for the active machine to the current display limit.

## Protocol Compatibility

If the inspected app uses a different protocol version than the panel, a **Compatibility** warning is shown above the machine selector. Commands are disabled for machines on mismatched protocol versions. Legacy protocol v3 machines are read-only in the current build.
