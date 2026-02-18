# Rxova Journey Devtools (Chrome)

Chrome DevTools extension for inspecting and controlling `@rxova/journey-core` machines.

## What it provides

- Per-tab connection status
- Multiple machine selection
- Snapshot inspector (`current/status`, `context`, `history`, `visited`, `async`)
- Event log (retains latest 2000 entries per machine)
- Command controls (`next`, `back`, `close`, `submit`, `goTo`, custom `send`, `reset`, `clearStepError`, `clearHistory`, `trimHistory`)

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
```

## App Integration (React)

```tsx
import { useEffect } from "react";
import { useJourneyMachine } from "@rxova/journey-react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const Bridge = () => {
  const machine = useJourneyMachine();
  useEffect(() => attachJourneyDevtools(machine, { label: "Signup" }), [machine]);
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

Browser integration smoke (extension runtime):

```bash
pnpm --filter apps-devtools build
pnpm --filter apps-devtools exec playwright install chromium
pnpm --filter apps-devtools test:browser
```
