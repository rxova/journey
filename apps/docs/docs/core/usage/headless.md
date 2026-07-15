---
id: headless
title: Headless migration
---

# Headless migration

`createHeadlessJourney` is not part of the V1 Core API. Choose a linear journey when callers should
be able to move directly to any declared step, or a graph journey when allowed destinations should
be explicit transitions.

The closest replacement for the old caller-driven mode is linear navigation:

```ts
import { createLinearJourney } from "@rxova/journey-core";

const machine = createLinearJourney({
  steps: ["start", "configure", "confirm"] as const,
  context: {}
});

machine.controls.start();
await waitUntilSettled(machine);
await machine.navigate.goToStepById("confirm");
```

See [Choosing a mode](./) for the V1 decision guide.
