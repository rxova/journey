# @rxova/journey-devtools-bridge

Connect Journey machines to Chrome DevTools.

<p>
  <a href="https://www.npmjs.com/package/@rxova/journey-devtools-bridge">
    <img src="https://img.shields.io/npm/v/@rxova/journey-devtools-bridge?color=0f8f6a" alt="npm" />
  </a>
  <img src="https://img.shields.io/badge/3.2%20kB-brotli-0f8f6a" alt="size" />
</p>

## Install

```bash
npm i @rxova/journey-devtools-bridge
```

## Usage

```ts
import { createJourneyMachine } from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const machine = createJourneyMachine(definition);
machine.start();

const detach = attachJourneyDevtools(machine, { label: "Checkout" });
```

## What It Does

- Streams snapshots and lifecycle events to the Journey DevTools panel in Chrome
- Supports remote commands: navigate steps, reset, send events, inspect execution paths
- Enabled by default in development, disabled in production unless explicitly opted in

## Documentation

- [Chrome DevTools Overview](https://rxova.org/docs/devtool/overview)
- [Panel Guide](https://rxova.org/docs/devtool/panel-guide)
- [Bridge API](https://rxova.org/docs/bridge/bridge-api)

## License

MIT
