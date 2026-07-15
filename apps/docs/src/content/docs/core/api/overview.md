---
title: Core API
sidebar_label: API overview
slug: /api
---

# Core API

## Main entry point

```ts
import {
  createLinearJourney,
  createGraphJourney,
  createGraphJourneyBuilder,
  normalizeGraphDefinition,
  MAX_RAISED_EVENTS
} from "@rxova/journey-core";
```

The package also exports the definition, machine, snapshot, hook, event, navigation, plugin, and
builder types used by those functions.

## Factories

```ts
createLinearJourney(definition, options?);
createGraphJourney(definition, options?);
createGraphJourneyBuilder<TypeBag>();
```

Shared options are `autoStart`, `defaultTimeoutMs`, and `plugins`. Graph options additionally allow
`handlers` to replace handlers stored on the definition.

## Machine surface

```ts
machine.getSnapshot();
machine.controls.start();
machine.controls.pause();
machine.controls.resume();
machine.controls.complete(payload);
machine.controls.terminate(payload);
machine.controls.restart();

await machine.navigate.goToStepById(id);
await machine.navigate.goToPreviousStep(n);
await machine.navigate.goToNextStep();
await machine.navigate.goToLastVisitedStep();

machine.context.update(updater);
machine.subscriptions.subscribeSelector(selector, listener, equals?);
machine.subscriptions.subscribeEvent(eventName, listener);
machine.dispose();
```

Graph machines add:

```ts
await machine.send(type, payload?);
```

Registered plugins appear under `machine.plugins`.

## Optional entry points

| Import                                      | Export                                               |
| ------------------------------------------- | ---------------------------------------------------- |
| `@rxova/journey-core/convert`               | `linearToGraphDefinition`                            |
| `@rxova/journey-core/persistence`           | `createPersistencePlugin` and helpers/types          |
| `@rxova/journey-core/autosave`              | `createAutosavePlugin` and helpers/types             |
| `@rxova/journey-core/analytics`             | `createAnalyticsPlugin` and helpers/types            |
| `@rxova/journey-core/replay`                | `createReplayPlugin` and helpers/types               |
| `@rxova/journey-core/diagnostics`           | `createDiagnosticsPlugin` and analysis helpers/types |
| `@rxova/journey-core/execution-paths`       | `createExecutionPathsPlugin`                         |
| `@rxova/journey-core/subscription-enhancer` | `createSubscriptionEnhancerPlugin`                   |

These entry points are independently tree-shakeable.

## Where to next

- [Machine API](/docs/core/api/machine-api)
- [Transitions syntax](/docs/core/api/transitions-syntax)
- [Graph builder](/docs/core/api/graph-builder)
