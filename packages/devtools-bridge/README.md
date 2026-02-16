# @rxova/journey-devtools-bridge

<p>
  <a href="https://www.npmjs.com/package/@rxova/journey-devtools-bridge">
    <img src="https://img.shields.io/badge/npm-%40rxova%2Fjourney--devtools--bridge-CB3837?logo=npm&logoColor=white" alt="npm package @rxova/journey-devtools-bridge" />
  </a>
  <a href="https://rxova.org/docs/devtool/bridge-api">
    <img src="https://img.shields.io/badge/docs-devtool%20bridge-0f8f6a" alt="Bridge docs" />
  </a>
  <a href="https://github.com/rxova/journey/actions/workflows/ci.yml">
    <img src="https://github.com/rxova/journey/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" />
  </a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/coverage%20(bridge)-95.64%25-yellowgreen" alt="Bridge coverage" />
  <a href="https://www.npmjs.com/package/@rxova/journey-devtools-bridge">
    <img src="https://img.shields.io/npm/v/@rxova/journey-devtools-bridge" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@rxova/journey-devtools-bridge">
    <img src="https://img.shields.io/npm/dm/@rxova/journey-devtools-bridge" alt="npm downloads" />
  </a>
  <a href="https://bundlephobia.com/package/@rxova/journey-devtools-bridge">
    <img src="https://img.shields.io/bundlephobia/minzip/%40rxova%2Fjourney-devtools-bridge" alt="Bundlephobia" />
  </a>
</p>

Explicit bridge that connects Journey machines to browser DevTools integrations.

Use this when you want runtime inspection and command controls from a DevTools panel.

`[OVERVIEW](https://rxova.org/docs/devtool/overview) | [GETTING STARTED](https://rxova.org/docs/devtool/getting-started) | [BRIDGE API](https://rxova.org/docs/devtool/bridge-api) | [PANEL GUIDE](https://rxova.org/docs/devtool/panel-guide) | [PROTOCOL](https://rxova.org/docs/devtool/protocol) | [TROUBLESHOOTING](https://rxova.org/docs/devtool/troubleshooting)`

## Install

```bash
npm i @rxova/journey-devtools-bridge
```

## Core Usage

```ts
import { createJourneyMachine } from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const machine = createJourneyMachine(journey);

// Attach once after machine creation.
const detach = attachJourneyDevtools(machine, {
  label: "Checkout Flow"
});

// Call detach() when unmounting or disposing the machine.
// detach();
```

## React Usage

```tsx
import { useEffect } from "react";
import { useJourneyMachine } from "@rxova/journey-react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

export const JourneyDevtoolsBridge = () => {
  const machine = useJourneyMachine();

  // Attach bridge for this provider-scoped machine.
  useEffect(() => {
    return attachJourneyDevtools(machine, { label: "Signup Flow" });
  }, [machine]);

  return null;
};
```

## API Surface

- `attachJourneyDevtools(machine, options?) => detach`
- `JourneyDevtoolsBridgeOptions`
- `JourneyDevtoolsCommand`
- `JourneyDevtoolsEnvelope`

## Runtime Defaults

- Enabled in non-production `NODE_ENV`.
- Disabled in production (unless `enabled: true`).
- No-op in non-browser environments (`window` unavailable).
- Commands enabled in non-production and disabled by default in production.

## Production Opt-In Example

```ts
attachJourneyDevtools(machine, { enabled: true, commandsEnabled: true });
```

Use explicit opts if your bundle does not provide `process.env.NODE_ENV`.

## Security Notes

- Same-page scripts can observe and emit page-level `postMessage` traffic.
- Keep command execution disabled in production unless explicitly required.
- Prefer inspect-only mode for sensitive environments (`commandsEnabled: false`).
- Bridge validation includes origin checks, payload validation, and rate limiting.

## Coverage Notes

Coverage badge is package-specific (`packages/devtools-bridge/test` against `packages/devtools-bridge/src`), not monorepo-wide.

## License

MIT
