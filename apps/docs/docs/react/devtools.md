---
title: Devtools Bridge (Chrome)
sidebar_position: 7
---

React integration for devtools is still done through a separate package: `@rxova/journey-devtools-bridge`.

This page exists as a compatibility entry point. The full documentation is split by package:

- Bridge package docs: `/docs/bridge/getting-started`, `/docs/bridge/bridge-api`, `/docs/bridge/protocol`, `/docs/bridge/examples`
- Chrome DevTools extension docs: `/docs/devtool/overview`, `/docs/devtool/panel-guide`, `/docs/devtool/troubleshooting`, `/docs/devtool/web-store`

## Quick React Integration

```tsx
import { useEffect } from "react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import { signupBindings } from "./journey-bindings";

const JourneyDevtoolsBridge = () => {
  const machine = signupBindings.useJourneyMachine();

  useEffect(() => {
    return attachJourneyDevtools(machine, { label: "Signup" });
  }, [machine]);

  return null;
};
```

For Chrome Web Store release status and extension details, see `/docs/devtool/web-store`.
