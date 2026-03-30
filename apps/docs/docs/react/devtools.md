---
title: Devtools Bridge (Chrome)
sidebar_position: 7
---

React integration for devtools still goes through `@rxova/journey-devtools-bridge`.

Chrome extension download:

- https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm

This page is a React-facing entry point. Full bridge documentation lives under `/docs/bridge/*`, and Chrome DevTools extension docs live under `/docs/devtool/*`.

## Quick React Integration

```tsx
import { useEffect } from "react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import { signupJourney } from "./signup-journey";

const JourneyDevtoolsBridge = () => {
  useEffect(() => {
    return attachJourneyDevtools(signupJourney.machine, {
      label: "Signup",
      pluginMetadata: {
        persistence: {
          key: "signup-journey",
          clearOnReset: true
        }
      }
    });
  }, []);

  return null;
};
```

For Chrome Web Store status and extension details, see `/docs/devtool/web-store`.

The current panel can inspect:

- live snapshots
- core observation events in the timeline
- read-only execution-path queries when the machine exposes `getExecutionPaths()`
