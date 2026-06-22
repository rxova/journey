---
title: Writing a plugin
sidebar_label: Writing a plugin
sidebar_position: 2
---

# Writing a plugin

The built-in plugins cover the common cases, but the plugin API is public — when you need a custom
capability, you can write one in a few lines. This page walks through the hooks, the one TypeScript
wrinkle to know about, and disposal behavior.

## The minimal shape

A plugin is a plain object with a `name` and a `setup` function. `setup` runs once per machine at
construction, before `startJourney()`, and returns a hooks object. Every hook is optional.

```ts
import type { JourneyMachinePlugin } from "@rxova/journey-core";

const myPlugin = {
  name: "my-plugin",
  setup: (context) => {
    // …read context, wire things up…
    return {}; // return hooks
  }
} satisfies JourneyMachinePlugin;
```

## The one TypeScript wrinkle

`setup` is generic over your machine's `TContext`, `TStepId`, `TEvents`, and `TStepMeta` — but
TypeScript can't infer those from a plugin factory that has its own, narrower types. The idiomatic
fix is to assert `setup`'s type:

```ts
import type { JourneyMachinePlugin } from "@rxova/journey-core";

const createMyPlugin = <TContext extends { userId: string }>() => {
  const setup = (({ resolvedJourney, buildInitialSnapshot }) => {
    return {
      onSnapshotChange: ({ snapshot }) => {
        // snapshot is typed loosely here — narrow to your known shape if you need to
      }
    };
  }) as JourneyMachinePlugin["setup"]; // ← the cast

  return { name: "my-plugin", setup } satisfies JourneyMachinePlugin;
};
```

The cast is safe — the hooks you return are structurally compatible with what Journey expects. The
alternative, making the plugin itself generic, pushes type parameters onto every caller and makes
for a worse API.

## What setup receives

| Field                               | Type                    | What it is                                                   |
| ----------------------------------- | ----------------------- | ------------------------------------------------------------ |
| `journey`                           | `JourneyDefinition`     | The original definition, as the caller passed it             |
| `resolvedJourney`                   | resolved definition     | Normalized definition with transitions flattened to an array |
| `options.requireExplicitCompletion` | `boolean`               | Whether the machine needs an explicit `completeJourney`      |
| `options.defaultTimeoutMs`          | `number \| undefined`   | Machine-level async timeout                                  |
| `buildInitialSnapshot`              | `() => JourneySnapshot` | A fresh initial snapshot (handy for reset hydration)         |

## The hooks

### `hydrateSnapshot`

Runs once at construction, your chance to override the starting snapshot. Plugins run in order, each
receiving the previous one's output — this is the seam persistence and server-side hydration use.

```ts
hydrateSnapshot: (snapshot) => {
  const persisted = localStorage.getItem("my-key");
  if (!persisted) return snapshot;
  return { ...snapshot, ...JSON.parse(persisted) };
};
```

### `onSnapshotChange`

Runs synchronously on every snapshot change, with the previous snapshot, the new one, and the
reason:

```ts
onSnapshotChange: ({ previousSnapshot, snapshot, reason }) => {
  if (reason === "async") return; // ignore async-phase-only updates

  analytics.track("journey_step_changed", {
    from: previousSnapshot.currentStepId,
    to: snapshot.currentStepId
  });
};
```

:::warning
This hook must be synchronous. Don't return a promise or mark it `async` — Journey won't await it,
and it'll log a warning and drop the result. Do async work elsewhere (kick it off here, but don't
make the machine wait).
:::

Reasons you'll see: `"async"`, `"context"`, `"navigation"`, `"reset"`, `"start"`, `"transition"`.

### `augmentMachine`

Runs once after construction to add methods to the machine. Return an object and its keys merge onto
the machine; trying to overwrite an existing property throws.

```ts
augmentMachine: ({ machine, resolvedJourney }) => ({
  inspect: () => ({
    stepCount: Object.keys(resolvedJourney.steps).length,
    currentStep: machine.getSnapshot().currentStepId
  })
});
```

TypeScript infers the extension's type from the return value, so callers get
`machine.inspect()` fully typed when the plugin is passed through the `plugins` option.

### `dispose`

Runs at teardown — `machine.dispose()`, or in React when the provider unmounts. Clean up
subscriptions, timers, and storage here.

```ts
dispose: () => {
  subscription.unsubscribe();
  localStorage.removeItem("draft-key");
};
```

## Ordering and errors

Plugins initialize in array order and dispose in that same order. Two behaviors are worth knowing:

- **Setup failure rolls back.** If a plugin's `setup` throws, already-initialized plugins are
  disposed in reverse order, and the error is re-thrown tagged with the plugin name:
  `Journey plugin "my-plugin" setup failed: …`.
- **Dispose is best-effort.** Every plugin's `dispose` runs even if an earlier one threw; the first
  error is re-thrown after the full pass, so one bad teardown can't strand the others.

## A complete plugin

A small analytics plugin that fires on real step changes and on teardown:

```ts
import type { JourneyMachinePlugin } from "@rxova/journey-core";

export const createStepTracker = (tracker: { track: (name: string, data: object) => void }) => {
  const setup = (({ resolvedJourney }) => {
    const stepCount = Object.keys(resolvedJourney.steps).length;

    return {
      onSnapshotChange: ({ snapshot, reason }) => {
        if (reason !== "transition") return;
        tracker.track("step_changed", { step: snapshot.currentStepId, stepCount });
      },
      dispose: () => tracker.track("journey_disposed", {})
    };
  }) as JourneyMachinePlugin["setup"];

  return { name: "step-tracker", setup } satisfies JourneyMachinePlugin;
};
```

```ts
import { createLinearJourney } from "@rxova/journey-core";

const machine = createLinearJourney(checkout, {
  plugins: [createStepTracker(myTracker)]
});
```

## Where to next

- [Plugins overview](/docs/core/plugins/overview) — the model and the built-ins.
- [Snapshot](/docs/core/snapshot#why-a-snapshot-changes) — the `reason` values your hooks receive.
- [How it works → Plugins](/docs/core/architecture#plugins) — the controller that calls your hooks.
