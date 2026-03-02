---
title: Devtools Bridge (Chrome)
sidebar_position: 7
---

Vue integration for devtools is still done through a separate package: `@rxova/journey-devtools-bridge`.

This page exists as a compatibility entry point. The full documentation lives in the dedicated Devtool section:

- [Overview](/docs/devtool/overview)
- [Getting Started](/docs/devtool/getting-started)
- [Bridge API](/docs/devtool/bridge-api)
- [Panel Guide](/docs/devtool/panel-guide)
- [Protocol](/docs/devtool/protocol)
- [Examples](/docs/devtool/examples)
- [Troubleshooting](/docs/devtool/troubleshooting)
- [Web Store](/docs/devtool/web-store)

## Quick Vue Integration

```ts
import { defineComponent, onMounted, onUnmounted } from "vue";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import { signupBindings } from "./journey-bindings";

export const JourneyDevtoolsBridge = defineComponent(() => {
  const machine = signupBindings.useJourneyMachine();
  let detach: (() => void) | undefined;

  onMounted(() => {
    detach = attachJourneyDevtools(machine, { label: "Signup" });
  });

  onUnmounted(() => {
    detach?.();
  });

  return () => null;
});
```

For Chrome Web Store release status and extension details, see [Web Store](/docs/devtool/web-store).
