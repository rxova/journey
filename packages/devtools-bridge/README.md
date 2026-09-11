# @rxova/journey-devtools-bridge

Connect current Journey Core machines to the Chrome DevTools extension.

## Install

```bash
npm install @rxova/journey-devtools-bridge
```

## Usage

```ts
import { createLinearJourney } from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const machine = createLinearJourney(definition, { autoStart: true });
const detach = attachJourneyDevtools(machine, {
  machineId: "checkout",
  label: "Checkout",
  eventTypes: ["continue", "cancel"],
  mutationsEnabled: false
});
```

The bridge registers the machine, streams v7 snapshots and observation events, and exposes generic
operation descriptors to the panel. It accepts v6 invoke envelopes and tolerates v5 registration
during rolling upgrades.

The bridge is enabled by default only outside production. When a bridge is enabled, mutating
operations are enabled by default; pass `mutationsEnabled: false` for inspection-only access.
Attaching never starts the machine.

The transport uses same-page `window.postMessage`. Treat inspected snapshot/context data as visible
to other scripts on the page, avoid secrets in journey state, keep production attachment disabled
unless required, and detach on teardown.

- [Bridge API](https://rxova.org/docs/bridge/bridge-api)
- [Protocol](https://rxova.org/docs/bridge/protocol)
- [Chrome extension](https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm)

## License

MIT
