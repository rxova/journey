---
title: "Machine Architecture"
sidebar:
  label: "Overview"
---

`packages/core/src/journey-machine` is the runtime assembly layer for Journey.

This section is organized file-by-file. Each page maps to one source file in that folder and explains what that
file owns, how it works, and which other docs to read next.

## File Map

- [`index.ts`](./architecture/create-journey-machine.md): validates the definition, builds the initial
  snapshot factory, creates every controller, and exposes the public machine API.
- [`resolve-journey-definition.ts`](./architecture/journey-definition-resolver.md): normalizes authored
  transition shapes into the single ordered list the runtime executes.
- [`plugin-controller.ts`](./architecture/plugin-controller.md): runs plugin setup, snapshot hydration,
  snapshot-change hooks, machine augmentation, and disposal.
- [`runtime.ts`](./architecture/runtime.md): owns the live snapshot, event listeners, selector listeners,
  and the serialized async queue.
- [`async-state.ts`](./architecture/async-state.md): updates `snapshot.async` and keeps the global
  `isLoading` flag in sync.
- [`navigation.ts`](./architecture/navigation.md): commits step changes, terminal states, and history-pointer
  navigation.
- [`send.ts`](./architecture/send.md): resolves an incoming event into a transition, runs guards and context updates,
  and delegates the final commit to navigation.
- [`controls.ts`](./architecture/controls.md): handles out-of-band mutations such as reset, context updates,
  error clearing, and disposal.
- [`helpers.ts`](./architecture/helpers.md): provides the shared pure utilities for validation, snapshot
  building, transition selection, and timeout handling.

## How The Folder Works Together

1. `createJourneyMachine` validates raw input and resolves the journey into a uniform runtime shape.
2. Plugins get one setup pass and one chance to hydrate the initial snapshot before runtime work begins.
3. The runtime becomes the single owner of mutable state, subscriptions, lifecycle events, and queued execution.
4. `send.ts` handles transition selection and async work, while `navigation.ts` performs the actual snapshot commit.
5. `controls.ts` covers the imperative operations that are intentionally outside transition matching.
6. `helpers.ts` keeps the reusable logic pure so the controllers can stay narrow.

That split is the core architectural choice: separate transition selection from snapshot commits, and separate both
from rendering concerns.

## Recommended Reading

- Start with [Core Overview](./overview.md) if you want the product model first.
- Read [Core API Overview](./api/overview.md) if you want the public surface before internals.
- Read [Snapshot](./snapshot.md), [Lifecycle](./lifecycle.md), [Async](./async.md), and
  [History](./history.md) when you want the runtime guarantees described from the user-facing side.
