---
title: Authoring Plugins
sidebar_label: Authoring Plugins
sidebar_position: 2
---

# Authoring Plugins

This guide covers everything needed to write a custom Journey plugin — type constraints, available hooks, the augment pattern, and disposal behavior.

## Minimal Plugin Shape

A plugin is a plain object with a `name` and a `setup` function.

```ts
import type { JourneyMachinePlugin } from "@rxova/journey-core";

const myPlugin = {
  name: "my-plugin",
  setup: (context) => {
    // return hooks
    return {};
  }
} satisfies JourneyMachinePlugin;
```

`setup` is called once per machine at construction time, before `machine.startJourney()`. It receives a setup context and returns a hooks object. All hooks are optional.

## The Type Cast Pattern

`setup` is generic over `TContext`, `TStepId`, `TEventMap`, and `TStepMeta`, but TypeScript cannot infer those generics from a plugin factory that has its own narrower types. The idiomatic solution is to assert the setup function's type:

```ts
import type { JourneyMachinePlugin } from "@rxova/journey-core";

const createMyPlugin = <TContext extends { userId: string }>() => {
  const setup = (({ resolvedJourney, buildInitialSnapshot }) => {
    // resolvedJourney, buildInitialSnapshot, etc. are available here
    return {
      onSnapshotChange: ({ snapshot }) => {
        // snapshot is typed loosely here — cast to your known shape if needed
      }
    };
  }) as JourneyMachinePlugin["setup"]; // ← the necessary cast

  return { name: "my-plugin", setup } satisfies JourneyMachinePlugin;
};
```

The cast is safe: the hooks you return are structurally compatible with the expected types. The alternative — making the plugin itself generic — creates a worse consumer API and requires the caller to manually pass type parameters.

## Setup Context

`setup` receives a `JourneyMachinePluginSetupContext` with everything available at construction time:

| Field                               | Type                        | Description                                                      |
| ----------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| `journey`                           | `JourneyDefinition`         | The original definition as passed by the caller                  |
| `resolvedJourney`                   | `JourneyResolvedDefinition` | Normalized definition with all transitions flattened to an array |
| `options.requireExplicitCompletion` | `boolean`                   | Whether the machine requires an explicit `completeJourney` call  |
| `options.defaultTimeoutMs`          | `number \| undefined`       | Machine-level async timeout                                      |
| `buildInitialSnapshot`              | `() => JourneySnapshot`     | Returns a fresh initial snapshot (useful for reset hydration)    |

## Available Hooks

### `hydrateSnapshot`

Called once at construction time to give the plugin a chance to override the starting snapshot. Plugins are applied in order; each receives the output of the previous.

```ts
hydrateSnapshot: (snapshot) => {
  const persisted = localStorage.getItem("my-key");
  if (!persisted) return snapshot;

  const saved = JSON.parse(persisted);
  return { ...snapshot, ...saved };
};
```

Use this for persistence, server-side hydration, or any startup override.

### `onSnapshotChange`

Called synchronously every time the machine snapshot changes. Receives the previous snapshot, the new snapshot, and the reason for the change.

```ts
onSnapshotChange: ({ previousSnapshot, snapshot, reason }) => {
  if (reason === "async") return; // skip async-phase-only updates

  analytics.track("journey_step_changed", {
    from: previousSnapshot.currentStepId,
    to: snapshot.currentStepId
  });
};
```

**This hook must be synchronous.** Do not return a Promise or use `async`. If you do, Journey will log a warning and the await will be silently dropped — the machine does not wait for async plugin hooks.

Available `reason` values: `"async"`, `"context"`, `"navigation"`, `"reset"`, `"start"`, `"transition"`.

### `augmentMachine`

Called once after machine construction to add methods to the machine object. Return an object whose keys will be merged onto the machine. Attempting to override an existing machine property throws an error.

```ts
augmentMachine: ({ machine, journey, resolvedJourney }) => ({
  inspect: () => ({
    stepCount: Object.keys(resolvedJourney.steps).length,
    currentStep: machine.getSnapshot().currentStepId
  })
});
```

The returned extension is merged with the base machine. TypeScript infers the extension type from `augmentMachine`'s return type when the plugin is passed through `createJourneyMachine`'s `plugins` option.

### `dispose`

Called when the machine is disposed — either by `machine.dispose()` or, in React, when the `JourneyProvider` unmounts.

```ts
dispose: () => {
  subscription.unsubscribe();
  localStorage.removeItem("draft-key");
};
```

Journey calls `dispose` on every plugin even if an earlier one throws. The first error is re-thrown after all plugins have had a chance to clean up.

## Disposal Ordering

Plugins are initialized in array order and disposed in the same order. The first error from any plugin's `dispose` is re-thrown after the full disposal pass completes.

```ts
createJourneyMachine(journey, {
  plugins: [pluginA, pluginB, pluginC]
  // dispose order: pluginA → pluginB → pluginC
  // if pluginA.dispose() throws, pluginB and pluginC still run,
  // then the error from pluginA is re-thrown
});
```

## Setup Errors

If `setup` throws, Journey wraps the error with the plugin name for easier debugging:

```
Journey plugin "my-plugin" setup failed: <original message>
```

## Full Example

```ts
import type { JourneyMachinePlugin } from "@rxova/journey-core";

export const createAnalyticsPlugin = (tracker: { track: (name: string, data: object) => void }) => {
  const setup = (({ resolvedJourney }) => {
    const stepCount = Object.keys(resolvedJourney.steps).length;

    return {
      onSnapshotChange: ({ snapshot, reason }) => {
        if (reason !== "transition") return;

        tracker.track("step_changed", {
          step: snapshot.currentStepId,
          stepCount
        });
      },
      dispose: () => {
        tracker.track("journey_disposed", {});
      }
    };
  }) as JourneyMachinePlugin["setup"];

  return { name: "analytics", setup } satisfies JourneyMachinePlugin;
};
```

```ts
const machine = createJourneyMachine(journey, {
  plugins: [createAnalyticsPlugin(myTracker)]
});
```
