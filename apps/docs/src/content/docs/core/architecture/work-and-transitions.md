---
title: "Work and transitions"
---

Journey splits decision-making sharply: guards are synchronous and pure; everything asynchronous
that must succeed before movement is transactional **work**; side effects run post-commit and
cannot block.

## Sync, pure guards

A graph transition's `when({ context, handlers })` guard runs synchronously and must stay pure,
because guards are evaluated both while routing a send and while deriving snapshot fields
(`availableEvents`, `availableSteps`, `outgoingTransitions`). A throwing guard is treated as
disabled.

## Sending a graph event

`send(type, payload?)` follows this selection path:

1. Reject if disposed, not running, or already transitioning.
2. Scan flattened transitions in declaration order.
3. Match event type and current `from` id.
4. Evaluate the synchronous guard, if present.
5. Run navigation with the first enabled candidate.

No match returns `no-enabled-transition`.

## Transactional work

Next/previous navigation and step-declared work-sends carry the same transaction shape: an
asynchronous `run` executes first, an optional synchronous `commit` stages a context update, and
the move is decided afterwards — all-or-nothing.

For a work-send, candidate guards are evaluated **against the staged context**. They never see the
result of `run` directly: a routing fact goes through `commit` into the staged context, and the
guards read it from there.

```ts
const review = {
  on: {
    submit: {
      run: ({ snapshot, handlers }) => handlers.verify(snapshot.context),
      commit: ({ result, updateContext }) =>
        updateContext((context) => ({ ...context, verified: result.ok })),
      candidates: [
        { to: "done", when: ({ context }) => context.verified },
        { to: "review" }, // totality fallback
      ],
    },
  },
};
```

That keeps guards total functions of context, so resting-state introspection
(`outgoingTransitions`, `availableEvents`) reports the same answer a live send would.

If `run` throws, rejects, or times out — or no candidate is enabled — nothing commits: the machine
stays on the source step and staged context updates are discarded. The caller receives a failed
`NavigationResult`.

## Totality

An unguarded last candidate pointing back at the declaring step is the totality fallback: it keeps
the event routable whatever `run` returned, so a staged failure outcome (an error message, an
attempt counter) commits instead of being rolled back. Leave it out when discarding the staged
context on an unmatched send is what you want.

## Committing a move

```mermaid
sequenceDiagram
  participant Caller
  participant Runtime
  participant Store
  participant Hooks

  Caller->>Runtime: send / navigate
  opt work supplied
    Runtime->>Store: publish working
    Runtime->>Runtime: await run, stage commit updates
  end
  alt work failed or no candidate enabled
    Runtime->>Store: publish settled source
    Runtime-->>Caller: failed NavigationResult
  else move accepted
    Runtime->>Runtime: commit context, timeline, and visits
    Runtime->>Store: publish committed destination
    Runtime->>Store: emit stepLeave, stepEnter
    Runtime->>Hooks: await onLeave, onTransition, onEnter
    Runtime->>Store: publish settled destination
    Runtime-->>Caller: successful NavigationResult
  end
```

Pointer moves update only `currentIndex`. Appending a destination truncates timeline entries after
the pointer, then appends the new id.

## Async state

The runtime exposes three related views:

- `snapshot.transition.pending` is the canonical UI-level pending flag;
- `snapshot.transition` describes the whole pending operation (`working`, `leaving`, or
  `entering`);
- `snapshot.currentStep.async` describes navigation work or lifecycle effects.

Navigation work runs before commit and may stop movement. `onLeave`, graph `onTransition`, and
destination `onEnter` run after commit, in that order. Their failure is stored on the destination
and emitted as an `error` event without rollback.

## Where to next

- [Effects](../effects)
- [Transitions syntax](../api/transitions-syntax)
- [Pinning types with a bag](../api/with-types)
