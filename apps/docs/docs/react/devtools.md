---
title: Devtools Bridge (Chrome)
sidebar_position: 7
---

React integration for devtools is still done through a separate package: `@rxova/journey-devtools-bridge`.

This page exists as a compatibility entry point. The full documentation lives in the dedicated Devtool section:

- `/docs/devtool/overview`
- `/docs/devtool/getting-started`
- `/docs/devtool/bridge-api`
- `/docs/devtool/panel-guide`
- `/docs/devtool/protocol`
- `/docs/devtool/examples`
- `/docs/devtool/troubleshooting`
- `/docs/devtool/web-store`

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
