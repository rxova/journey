---
id: architecture
title: Machine Architecture
sidebar_label: Overview
---

# Machine Architecture

`packages/core/src/journey-machine` is the runtime assembly layer for Journey.

This section is organized file-by-file. Each page maps to one source file and explains what that file owns, how it works, and which other docs to read alongside it.

## File Map

| File                                                                          | Responsibility                                                                                                              |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [`index.ts`](./architecture/create-journey-machine)                           | Validates the definition, resolves it into a uniform runtime shape, creates all controllers, exposes the public machine API |
| [`resolve-journey-definition.ts`](./architecture/journey-definition-resolver) | Normalizes authored transition shapes into the single ordered list the runtime executes                                     |
| [`plugin-controller.ts`](./architecture/plugin-controller)                    | Runs plugin setup, snapshot hydration, snapshot-change hooks, machine augmentation, and disposal                            |
| [`runtime.ts`](./architecture/runtime)                                        | Owns the live snapshot, event listeners, selector listeners, and the serialized async queue                                 |
| [`async-state.ts`](./architecture/async-state)                                | Updates `snapshot.async` and keeps the global `isLoading` flag in sync                                                      |
| [`navigation.ts`](./architecture/navigation)                                  | Commits step changes, terminal states, and history-pointer navigation                                                       |
| [`send.ts`](./architecture/send)                                              | Resolves an incoming event into a transition, runs guards and context updates, delegates the final commit to navigation     |
| [`controls.ts`](./architecture/controls)                                      | Handles out-of-band mutations: reset, context updates, error clearing, and disposal                                         |
| [`helpers.ts`](./architecture/helpers)                                        | Shared pure utilities for validation, snapshot building, transition selection, and timeout handling                         |

## How the Folder Works Together

```
createLinearJourney / createGraphJourney / createHeadlessJourney
        ↓
  createJourneyMachine (internal)
        ↓
  1. Validate + resolve definition
  2. Build initial snapshot factory
  3. Plugin controller (setup + hydration)
  4. Runtime (snapshot + subscriptions + queue)
  5. Async-state, navigation, send, controls
  6. Assemble public machine API
  7. Plugin machine augmentation
```

:::note
The three public factories (`createLinearJourney`, `createGraphJourney`, `createHeadlessJourney`) each adapt their input into a normalized `JourneyDefinition` before calling the internal `createJourneyMachine`. The architecture documented here describes that internal layer.
:::

**Key separation of concerns:**

- **Transition selection** (`send.ts`) is separate from **snapshot commits** (`navigation.ts`)
- **Out-of-band mutations** (`controls.ts`) bypass the transition graph entirely
- **Plugin behavior** is isolated to the plugin controller — core files don't import it
- **Pure utilities** (`helpers.ts`) stay side-effect free so controllers stay narrow

## Recommended Reading

- Start with [Core Overview](/docs/core/overview) if you want the product model first.
- Read [API Overview](/docs/core/api) if you want the public surface before internals.
- Read [Snapshot](/docs/core/snapshot), [Lifecycle](/docs/core/lifecycle), [Async](/docs/core/async), and [History](/docs/core/history) for the runtime guarantees described from the user-facing side.
