---
id: subscription-enhancer-plugin
title: Subscription enhancer
---

# Subscription enhancer

This plugin adds status-filtered convenience subscriptions while keeping the base machine surface
small.

```ts
import { createSubscriptionEnhancerPlugin } from "@rxova/journey-core/subscription-enhancer";

const machine = createLinearJourney(definition, {
  plugins: [createSubscriptionEnhancerPlugin()]
});

const lifecycle = machine.plugins["subscription-enhancer"];
const stop = lifecycle.subscribeComplete(({ snapshot }) => {
  console.log(snapshot.machine.outcome);
});
```

The API provides `subscribeStart`, `subscribeRestart`, `subscribeComplete`, `subscribeTerminate`,
`subscribePause`, and `subscribeResume`. Every method returns its unsubscribe function and is sugar
over the core `statusChange` observation.
