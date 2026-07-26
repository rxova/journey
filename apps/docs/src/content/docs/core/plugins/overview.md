---
title: "Plugins"
---

# Plugins

Plugins let Journey stay small by default and expandable when your runtime needs more.

The base machine is responsible for transitions, navigation, snapshot updates, async behavior, and lifecycle events. Plugins extend that runtime without forcing every machine to carry every optional feature.

## Why Plugins Exist

Some capabilities are important, but not universal.

Persistence is a good example. Many teams need resume-later behavior. Many do not. Structural execution-path analysis is similar: it is valuable for tooling, testing, and product review, but it should not make the base runtime heavier for everybody else.

Plugins keep those capabilities opt-in.

Compatibility expectations for plugins are documented in the shared [Stability Contract](../stability.md).

## The Plugin Model

A plugin hooks into machine setup and runtime lifecycle.

In practice, a plugin can:

- inspect the resolved journey definition during setup
- hydrate or adjust the starting snapshot
- react to snapshot changes over time
- augment the machine with extra methods

That is enough to support both “react to runtime changes” plugins and “extend the machine API” plugins.

## Typical Shape

```ts
import { createJourneyMachine } from "@rxova/journey-core";
import { createAnalyticsPlugin } from "@rxova/journey-core/analytics";
import { createAutosavePlugin } from "@rxova/journey-core/autosave";
import { createDiagnosticsPlugin } from "@rxova/journey-core/diagnostics";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import { createReplayPlugin } from "@rxova/journey-core/replay";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";

const machine = createJourneyMachine(journey, {
  plugins: [
    createPersistencePlugin({
      key: "checkout-journey",
      version: 2
    }),
    createAutosavePlugin({
      key: "checkout-draft"
    }),
    createAnalyticsPlugin({
      track: (event) => analytics.track(event.name, event.payload)
    }),
    createReplayPlugin(),
    createDiagnosticsPlugin(),
    createExecutionPathsPlugin()
  ]
});
```

## Included Plugin Families

### Persistence Plugin

Use the persistence plugin when the machine should hydrate from storage and keep its snapshot durable across sessions.

Read [Persistence Plugin](../persistence.md).

### Autosave Plugin

Use the autosave plugin when you want debounced draft saving, hydration, and a save-status API for UI state.

Read [Autosave Plugin](../autosave.md).

### Analytics Plugin

Use the analytics plugin when you want normalized lifecycle events sent to your analytics client without polluting transition logic.

Read [Analytics Plugin](./analytics-plugin.md).

### Replay Plugin

Use the replay plugin when you want an in-memory capture of snapshots and lifecycle events for debugging, export, or bug reports.

Read [Replay Plugin](./replay-plugin.md).

### Diagnostics Plugin

Use the diagnostics plugin when you want structural checks such as unreachable steps, dead ends, shadowed transitions, or cycles exposed through the machine API.

Read [Diagnostics Plugin](./diagnostics-plugin.md).

### Execution Paths Plugin

Use the execution-paths plugin when you want structural path analysis from the declared journey definition without executing the flow.

Read [Execution Paths Plugin](./execution-paths-plugin.md).

## Guidance

- Reach for a plugin when the capability is optional, cross-cutting, or tooling-oriented.
- Keep core transition logic in the journey definition, not in plugins.
- Treat plugins as runtime extensions, not as a replacement for clear transition modeling.
- Depend on documented plugin hooks and published entrypoints, not internal machine controller structure.
