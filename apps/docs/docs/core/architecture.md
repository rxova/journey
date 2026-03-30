---
id: architecture
title: Machine Architecture
sidebar_label: Overview
---

`packages/core/src/journey-machine` is the runtime assembly layer for Journey.

This section is organized file-by-file. Each page maps to one source file in that folder and explains what that
file owns, how it works, and which other docs to read next.

## File Map

- [`index.ts`](/docs/core/architecture/create-journey-machine): validates the definition, builds the initial
  snapshot factory, creates every controller, and exposes the public machine API.
- [`resolve-journey-definition.ts`](/docs/core/architecture/journey-definition-resolver): normalizes authored
  transition shapes into the single ordered list the runtime executes.
- [`plugin-controller.ts`](/docs/core/architecture/plugin-controller): runs plugin setup, snapshot hydration,
  snapshot-change hooks, machine augmentation, and disposal.
- [`runtime.ts`](/docs/core/architecture/runtime): owns the live snapshot, event listeners, selector listeners,
  and the serialized async queue.
- [`async-state.ts`](/docs/core/architecture/async-state): updates `snapshot.async` and keeps the global
  `isLoading` flag in sync.
- [`navigation.ts`](/docs/core/architecture/navigation): commits step changes, terminal states, and history-pointer
  navigation.
- [`send.ts`](/docs/core/architecture/send): resolves an incoming event into a transition, runs guards and context updates,
  and delegates the final commit to navigation.
- [`controls.ts`](/docs/core/architecture/controls): handles out-of-band mutations such as reset, context updates,
  error clearing, and disposal.
- [`helpers.ts`](/docs/core/architecture/helpers): provides the shared pure utilities for validation, snapshot
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

- Start with [Core Overview](/docs/core/overview) if you want the product model first.
- Read [Core API Overview](/docs/core/api) if you want the public surface before internals.
- Read [Snapshot](/docs/core/snapshot), [Lifecycle](/docs/core/lifecycle), [Async](/docs/core/async), and
  [History](/docs/core/history) when you want the runtime guarantees described from the user-facing side.
