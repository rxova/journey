# Rxova Journey DevTools

Chrome DevTools extension for inspecting and controlling current `@rxova/journey-core` machines.

Install it from the [Chrome Web Store](https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm).

## What the panel provides

- Per-tab connection and protocol compatibility status.
- Selection between multiple machines registered by one page.
- Inspection of the current immutable linear or graph snapshot.
- A Redux-style timeline with Action, State, and Diff views.
- Follow-latest, display-limit, and local prune controls.
- Forms generated from generic machine and plugin operation descriptors.
- Light/dark theme integration with Chrome DevTools.

Timeline selection is local to the extension. Selecting an older row changes the inspector view but
does not rewind or mutate the runtime machine.

## App integration

```ts
import { createLinearJourney } from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const machine = createLinearJourney(definition, {
  autoStart: true
});

const detach = attachJourneyDevtools(machine, {
  machineId: "checkout",
  label: "Checkout",
  mutationsEnabled: false
});
```

For React graph Providers, capture the mounted machine with `machineRef`, attach it in an effect,
and return the detach function from that effect.

## Protocol and compatibility

The current bridge protocol is v7. v6 invokes remain compatible because their envelope shape is
unchanged. v5 registration is tolerated during rolling upgrades but remains read-only.

The panel does not hard-code one command list. It groups the feature and operation descriptors
advertised by the attached bridge. Descriptors provide operation IDs, fields, mutation flags, and
result kinds.

## Security

The bridge is disabled by default in production. An explicitly enabled bridge permits mutating
operations unless `mutationsEnabled: false` is set.

The transport uses same-page `window.postMessage`. Other scripts executing in the inspected page
can observe page-level traffic, so do not place credentials or secrets in journey snapshots,
context, or metadata. Keep production attachment off unless it is deliberately required, prefer
inspect-only mode in sensitive environments, and detach during teardown.

## Local development

```bash
pnpm --filter apps-devtools dev
```

Build the extension:

```bash
pnpm --filter apps-devtools build
```

Load `apps/devtools/dist` as an unpacked extension. Open Chrome DevTools on an app that attached at
least one Journey machine and select the Journey panel.

## Testing

```bash
pnpm test -- --run apps/devtools/test
pnpm --filter apps-devtools typecheck
```

The extension is Manifest V3, uses bundled code only, and requests only the permissions declared in
its manifest.
