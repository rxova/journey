---
title: Persistence and Migration
sidebar_position: 8
---

Persistence is optional and configured through `createJourneyMachine(..., { persistence })`.

## Basic Configuration

```ts
const machine = createJourneyMachine(journey, {
  persistence: {
    key: "checkout-journey",
    version: 2
  }
});
```

## Stored Data

Persisted snapshot includes:

- `current`
- `context`
- `history`
- `visited`
- `status`
- wrapper `version`

Not persisted:

- runtime async state (`snapshot.async`)

## Migration

Use `migrate` when persisted version changes.

```ts
const machine = createJourneyMachine(journey, {
  persistence: {
    key: "checkout-journey",
    version: 2,
    migrate: (persisted, oldVersion) => {
      if (oldVersion === 1) {
        const v1 = persisted as { context?: { fullName?: string } };
        return {
          current: "start",
          context: { name: v1.context?.fullName ?? "" },
          history: [],
          visited: ["start"],
          status: "running"
        };
      }

      return persisted as {
        current: "start" | "review";
        context: { name: string };
        history: Array<"start" | "review">;
        visited: Array<"start" | "review">;
        status: "running" | "complete" | "closed";
      };
    }
  }
});
```

## Reset Interaction

- default `clearOnReset: true`: remove persisted entry on reset
- `clearOnReset: false`: write reset snapshot instead

## Error Handling

Use `onError` to observe storage/serialization failures.

```ts
persistence: {
  key: "checkout-journey",
  version: 1,
  onError: (error) => reportPersistenceError(error)
}
```

## Adapter Contract

You can supply custom storage adapter implementing `getItem`, `setItem`, `removeItem`.

Use this for server-like environments or custom storage backends.
