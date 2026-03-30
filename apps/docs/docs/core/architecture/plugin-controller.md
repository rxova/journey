---
title: Plugin Controller Lifecycle
sidebar_label: Plugin Lifecycle
---

Source file: `packages/core/src/journey-machine/plugin-controller.ts`

This file is the adapter between the core machine and optional plugins.

Its job is deliberately narrow: run `plugin.setup(...)` once, keep the resulting hooks organized, and call those
hooks at the right points in the machine lifecycle.

## How It Works

1. During setup, the controller calls every plugin's `setup(...)` function with the same setup context. If a plugin
   throws, the file rolls back already-initialized plugins by calling their `dispose()` hooks in reverse order, then
   wraps the original setup error with the plugin name so failures are attributable.
2. `hydrateSnapshot(...)` reduces over the plugin hook list, letting each plugin transform the starting snapshot
   before the runtime owns it.
3. `onSnapshotChange(...)` fans out every committed snapshot change, including the previous snapshot and the
   machine-level reason for the write.
4. `extendMachine(...)` lets plugins add extra methods or properties to the public machine. The controller refuses
   collisions so a plugin cannot silently override existing machine API.
5. `dispose()` forwards to every plugin hook so storage listeners, timers, or other resources can clean up.

This is how Journey keeps the base runtime small while still supporting features such as persistence and execution
path analysis.

## Recommended Reading

- Read [createJourneyMachine](/docs/core/architecture/create-journey-machine) to see when plugin setup runs.
- Read [Plugins Overview](/docs/core/plugins/overview) for the public extension model.
- Read [Persistence](/docs/core/persistence) and [Execution Paths Plugin](/docs/core/plugins/execution-paths-plugin)
  for concrete examples of these hooks in use.
