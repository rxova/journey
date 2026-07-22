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
  MAX_RAISED_EVENTS
} from "@rxova/journey-core";
```

The package also exports the definition, machine, snapshot, hook, event, navigation, plugin, and
builder types used by those functions.

## Errors

Everything Core throws itself is a `JourneyError` carrying a machine-readable `code`, plus the
offending `stepId`, `event`, or `pluginName` where one applies:

```ts
import { createLinearJourney, isJourneyError } from "@rxova/journey-core";

try {
  createLinearJourney(definition, { startAt: idFromRoute });
} catch (error) {
  if (isJourneyError(error) && error.code === "unknown-step") {
    redirectToFirstStep(error.stepId);
  }
}
```

`code` is the stable contract and a closed union: `empty-definition`, `duplicate-step-id`,
`unknown-step`, `unknown-initial-step`, `dangling-transition`, `duplicate-plugin-name`,
`storage-unavailable`, `async-commit`. Messages are for humans and may be reworded in any release —
never match on them.

Failures that are not Core's own stay untyped. `NavigationResult.error` and the `error` subscription
event carry whatever your navigation work or hooks threw, which Core cannot constrain.

## Factories

```ts
createLinearJourney(definition, options?);
createGraphJourney(definition, options?);
createGraphJourneyBuilder<TypeBag>();
```

Graph options additionally allow `handlers` to replace handlers stored on the definition.

### Creation options

Both factories accept the same `JourneyRuntimeOptions`:

| Option             | Meaning                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `autoStart`        | Start immediately at creation. Defaults to `false`, so subscribe-before-start is the natural order.                                                                                                                                                                             |
| `startAt`          | Start (and restart) directly at this step: only its `onEnter` fires, earlier steps are neither entered nor visited, and the timeline begins as `[startAt]`. An unknown id throws at creation. Wins over a persisted `persist` record.                                           |
| `persist`          | `{ key, storage? }` sugar that registers the persistence plugin **and restores**: a valid non-terminal record found at creation seeds context, timeline, and position, so the first `start()` resumes at the persisted step. See [Persistence](/docs/core/persistence#restore). |
| `defaultTimeoutMs` | Applies to navigation/send work and every async hook. Work timeouts block movement; post-commit hook timeouts surface as step errors.                                                                                                                                           |
| `onListenerError`  | Called when a subscriber (selector or event listener) throws. Listener failures are always isolated — this option only routes the report. Defaults to `console.error`; a throwing reporter falls back to that default.                                                          |
| `plugins`          | Observe-only plugin instances; see [Plugins](/docs/core/plugins/overview).                                                                                                                                                                                                      |

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
| `@rxova/journey-core/connectors/immer`      | `immerConnector` and `ImmerContextRecipe`            |
| `@rxova/journey-core/persistence`           | `createPersistencePlugin` and helpers/types          |
| `@rxova/journey-core/autosave`              | `createAutosavePlugin` and helpers/types             |
| `@rxova/journey-core/analytics`             | `createAnalyticsPlugin` and helpers/types            |
| `@rxova/journey-core/replay`                | `createReplayPlugin` and helpers/types               |
| `@rxova/journey-core/diagnostics`           | `createDiagnosticsPlugin` and analysis helpers/types |
| `@rxova/journey-core/execution-paths`       | `createExecutionPathsPlugin`                         |
| `@rxova/journey-core/subscription-enhancer` | `createSubscriptionEnhancerPlugin`                   |

These entry points are independently tree-shakeable. Connectors adapt optional third-party
libraries to Core primitives; the Immer connector requires `immer` as a peer only when that entry
point is used.

## Where to next

- [Machine API](/docs/core/api/machine-api)
- [Transitions syntax](/docs/core/api/transitions-syntax)
- [Graph builder](/docs/core/api/graph-builder)
