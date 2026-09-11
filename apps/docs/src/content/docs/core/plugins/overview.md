---
title: "Plugins"
---

Plugins observe a journey and add namespaced APIs or snapshot data. They do not intercept
navigation, replace snapshots, or merge methods into the base machine.

## Add plugins

```ts
import { createLinearJourney } from "@rxova/journey-core";
import { createReplayPlugin } from "@rxova/journey-core/replay";
import { createDiagnosticsPlugin } from "@rxova/journey-core/diagnostics";

const machine = createLinearJourney(definition, {
  plugins: [createReplayPlugin(), createDiagnosticsPlugin()]
});

machine.plugins.replay.getReplaySession();
machine.plugins.diagnostics.getDiagnostics();
```

Plugin names must be unique within a machine. Keep a plugin array as a readonly tuple when you need
precise TypeScript inference.

## Machine and snapshot extensions

A plugin can contribute either or both:

```ts
machine.plugins[name];
machine.getSnapshot().plugins[name];
```

Machine extensions are commands and reads implemented by the plugin. Snapshot extensions are
derived, observable values suitable for selectors and UI rendering.

## Built-in plugins

| Plugin                                                  | Purpose                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| [Persistence](../persistence)                           | Write status, context, and timeline on every observed change. |
| [Autosave](../autosave)                                 | Debounce the same persisted-state write.                      |
| [Analytics](./analytics-plugin)                         | Normalize lifecycle observations and custom analytics events. |
| [Replay](./replay-plugin)                               | Record a bounded, exportable runtime session.                 |
| [Diagnostics](./diagnostics-plugin)                     | Analyze the static journey structure.                         |
| [Execution paths](./execution-paths-plugin)             | Track realized paths for current and finished runs.           |
| [Subscription enhancer](./subscription-enhancer-plugin) | Add status-filtered lifecycle helpers.                        |

Each plugin is published through a separate package entry point so unused integrations do not add
to a factory's bundle.

## Plugin guarantees

- `setup` runs once per machine.
- Per-machine state should be created inside `setup`, even when one plugin object is reused.
- Host observation callbacks are isolated from the core pipeline.
- `onDispose` callbacks run during machine teardown and cannot break other teardown work.
- Snapshot derivation receives the previous extension so plugins can preserve references.

## Where to next

- [Writing a plugin](./authoring)
- [How it works](../architecture#plugins)
