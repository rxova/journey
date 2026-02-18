---
title: Devtools Bridge (Chrome)
sidebar_position: 7
---

This topic has moved into a dedicated top-level docs section:

- `/docs/devtool/overview`
- `/docs/devtool/getting-started`
- `/docs/devtool/bridge-api`
- `/docs/devtool/panel-guide`
- `/docs/devtool/protocol`
- `/docs/devtool/examples`
- `/docs/devtool/troubleshooting`
- `/docs/devtool/web-store`

Use this React page as a compatibility entry point if you came from older links.

## Quick React Integration

```tsx
import { useEffect } from "react";
import { useJourneyMachine } from "@rxova/journey-react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const JourneyDevtoolsBridge = () => {
  const machine = useJourneyMachine();

  useEffect(() => {
    return attachJourneyDevtools(machine, { label: "Signup" });
  }, [machine]);

  return null;
};
```
