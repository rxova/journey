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
  onLeave: async ({ snapshot, to, updateContext }) => {
    const valid = await validate(snapshot.context);
    updateContext((context) => ({ ...context, validated: valid }));
    return valid;
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

## `onLeave`: pre-commit gate

`onLeave` may be sync or async. Navigation is cancelled when it returns `false`, throws, rejects,
or exceeds `defaultTimeoutMs`.

While it runs, `snapshot.transition` has `pending: true` and `phase: "leaving"`. A second navigation
returns `reason: "transitioning"`.

Context updates made by the hook are not transactional: they remain even when navigation is
cancelled.

## `onEnter`: post-commit effect

`onEnter` runs after history and current-step state commit. It cannot cancel the move. While it
runs, the destination has `currentStep.async.isLoading: true` and the transition phase is
`"entering"`.

An error is stored in `currentStep.async.error` and emitted through the named `error` subscription.
The machine remains on the committed destination.

## Graph transition effects

Graph transitions may declare `onTransition`. It runs after commit and before destination
`onEnter`. If it fails, `onEnter` is skipped and the failure is reported with phase `"transition"`.

## Timeouts

The runtime option applies one timeout to every async hook invocation:

```ts
createGraphJourney(definition, { defaultTimeoutMs: 5_000 });
```

The timeout does not abort the underlying promise. Generation checks prevent stale completions from
committing after terminate, restart, or dispose.

## Where to next

- [Async behavior](../async)
- [Lifecycle and events](../lifecycle)
- [Effects](../effects)
