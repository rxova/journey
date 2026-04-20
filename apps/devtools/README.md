# Rxova Journey Devtools (Chrome)

Chrome DevTools extension for inspecting and controlling `@rxova/journey-core` machines.

## What it provides

- Per-tab connection status
- Multiple machine selection
- Redux-style timeline inspector (`Action`, `State`, `Diff`) with local time travel
- Timeline retention controls (display limit + prune, retaining latest 2000 rows per machine)
- Command controls (`startJourney`, `goToNextStep`, `terminateJourney`, `completeJourney`, `resetJourney`, `goToLastVisitedStep`, `goToStepById`, `goToPreviousStep`, custom `send`, `clearStepError`, `getExecutionPaths`)
- Theme follows Chrome DevTools / OS preference (light + dark)

## Prerequisites

- App integrates `@rxova/journey-devtools-bridge`
- Browser: Chrome (Manifest V3)

The extension injects its content bridge at runtime only for inspected tabs with an active Journey panel.

## Security Notes

- Command execution should remain disabled by default in production contexts.
- Use `commandsEnabled: false` for inspect-only mode in sensitive contexts.
- Disable bridge integration in production when runtime debugging is not needed.
- Same-page scripts can observe and emit page-level `postMessage` traffic.
- Robustness controls include origin checks, rate limiting, payload validation, and typed message guards.
- DevTools warnings now include structured codes for injection issues to support deterministic troubleshooting.

## App Integration (Core)

```ts
import { createJourneyMachine } from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const machine = createJourneyMachine(journey);
attachJourneyDevtools(machine, { label: "Checkout" });
machine.startJourney();
```

## App Integration (React)

```tsx
import { useEffect } from "react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import { signupJourney } from "./signup-journey";

const Bridge = () => {
  useEffect(() => attachJourneyDevtools(signupJourney.machine, { label: "Signup" }), []);
  return null;
};
```

## Local Development

```bash
pnpm --filter apps-devtools dev
```

## Build

```bash
pnpm --filter apps-devtools build
```

Load unpacked extension from:

- `apps/devtools/dist`

Then open Chrome DevTools on your app page and use the `Journey` panel.

## CI Artifact Workflow

The repository includes `.github/workflows/devtools.yml`.

It runs on `main` pushes when devtools or key workspace files change, then:

- typechecks devtools app
- runs devtools tests
- builds extension
- uploads `apps-devtools-dist.tgz` as a workflow artifact

## Web Store Readiness Checklist

- Manifest V3 is used with explicit minimal permissions
- Static icons are included at `16/32/48/128`
- No remote code execution or remote script loading
- Deterministic production build via `vite build`
- Placeholder screenshots are available in `public/screenshots`

Required submission assets to replace:

- `public/icons/icon16.png`
- `public/icons/icon32.png`
- `public/icons/icon48.png`
- `public/icons/icon128.png`
- `public/screenshots/panel-placeholder.png`

## Testing

```bash
pnpm test -- --run apps/devtools/test
```

Browser integration smoke is temporarily disabled in CI.
