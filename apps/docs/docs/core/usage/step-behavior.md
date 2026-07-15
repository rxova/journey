---
id: step-behavior
title: Step behavior
---

# Step behavior

Step configs keep static UI metadata and lifecycle behavior beside the step they describe.

## Step config

```ts
const step = {
  id: "review",
  metadata: { title: "Review order" },
  onLeave: async ({ snapshot, to }) => {
    await analytics.track("review_left", { order: snapshot.context.orderId, to });
  },
  onEnter: ({ from, event, raise }) => {
    if (event?.type === "SUBMIT") raise({ type: "AUDIT" });
  }
};
```

Linear steps may be bare strings. Graph definitions use a record, so the key is the id and the
config does not repeat it.

## Hook arguments

| Field           | Meaning                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `snapshot`      | The latest snapshot at the point the hook is called.                    |
| `from`          | Source step, or `null` on initial entry.                                |
| `to`            | Destination step.                                                       |
| `event`         | Causing graph event, or `null` for initial, linear, and timeline moves. |
| `updateContext` | Synchronous immutable context update.                                   |
| `raise`         | Queue a graph event after the current move settles; a no-op in linear.  |

## Work that can stop navigation

Attach transactional work to next or previous navigation:

```ts
await machine.navigate.goToNextStep({
  run: async ({ snapshot }) => {
    const validation = await validate(snapshot.context);
    if (!validation.valid) throw new Error("Review is invalid");
    return validation;
  },
  commit: ({ result, updateContext }) => {
    updateContext((context) => ({ ...context, validatedAt: result.checkedAt }));
  }
});
```

While `run` executes, phase is `"working"` and the source remains current. `commit` is synchronous;
its updates and navigation publish atomically. A work failure returns `reason: "error"` without
changing position or context.

## `onLeave`: post-commit source effect

`onLeave` runs after position commits. It is awaited, but returning a value has no navigation
meaning and a failure cannot undo the move. Use it for cleanup, analytics, and other source effects.

## `onEnter`: post-commit effect

`onEnter` runs after history and current-step state commit. It cannot cancel the move. While it
runs, the destination has `currentStep.async.isLoading: true` and the transition phase is
`"entering"`.

An error is stored in `currentStep.async.error` and emitted through the named `error` subscription.
The machine remains on the committed destination.

## Graph transition effects

Graph transitions may declare `onTransition`. It runs after `onLeave` and before destination
`onEnter`. A failure is reported with phase `"transition"`, and `onEnter` still runs.

## Timeouts

The runtime option applies one timeout to navigation `run` and every async hook invocation:

```ts
createGraphJourney(definition, { defaultTimeoutMs: 5_000 });
```

The timeout does not abort the underlying promise. Generation checks prevent stale completions from
committing after terminate, restart, or dispose.

## Where to next

- [Async behavior](../async)
- [Lifecycle and events](../lifecycle)
- [Effects](../effects)
