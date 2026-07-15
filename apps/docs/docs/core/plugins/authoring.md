---
title: Writing a plugin
sidebar_position: 2
---

# Writing a plugin

A plugin has a unique name and one `setup(host)` method. Setup returns a namespaced API, a snapshot
deriver, or both.

## Minimal plugin

```ts
import type { JourneyPlugin } from "@rxova/journey-core";

type CounterApi = { count(): number };
type CounterSnapshot = { transitions: number };

export function createCounterPlugin(): JourneyPlugin<"counter", CounterApi, CounterSnapshot> {
  return {
    name: "counter",
    setup(host) {
      let transitions = 0;

      host.onTransition(() => {
        transitions += 1;
      });

      return {
        api: {
          count: () => transitions
        },
        deriveSnapshot: (_snapshot, previous) =>
          previous?.transitions === transitions ? previous : { transitions }
      };
    }
  };
}
```

State belongs inside `setup`. Reusing one plugin object across machines must not share counters,
buffers, timers, or subscriptions.

## Plugin host

### Reads

```ts
host.getSnapshot();
host.structure;
```

`structure` is a frozen view with `kind`, `stepIds`, `initial`, and flattened transitions. Each
transition exposes `event`, `from`, `to`, and whether it is guarded.

### Observation taps

```ts
host.onTransition(listener);
host.onStepEnter(listener);
host.onStepLeave(listener);
host.onNavigationBlocked(listener);
host.onStatusChange(listener);
host.onContextChange(listener);
host.onError(listener);
```

Each returns an unsubscribe function. `onTransition` runs after post-commit hooks settle; the named
event taps follow the same payloads as machine subscriptions.

### Disposal

```ts
host.onDispose(() => clearTimeout(timer));
```

Register cleanup for resources owned by the plugin. Disposal callbacks are run once and isolated
from one another.

## API contribution

The returned `api` appears only under the plugin name:

```ts
machine.plugins.counter.count();
```

Do not expose mutable plugin internals. Return snapshots, copies, or readonly data from read APIs.

## Snapshot contribution

`deriveSnapshot(snapshot, previousExtension)` runs during snapshot construction. Keep it pure and
return the previous object when its visible value has not changed:

```ts
deriveSnapshot: (_snapshot, previous) =>
  previous?.transitions === transitions ? previous : { transitions };
```

The value appears at `snapshot.plugins.counter` and can be observed with `subscribeSelector`.

Snapshot derivation may run more than once around one lifecycle operation because the runtime
refreshes plugin-derived state after observation taps.

## Boundaries

The V1 host is deliberately observe-only. A plugin cannot:

- cancel or rewrite navigation;
- mutate the core snapshot;
- dispatch graph events through the host;
- add unnamespaced methods to the machine.

Put domain transition behavior in the definition. Use plugins for recording, persistence, analysis,
and integrations driven by observations.

## Where to next

- [Plugins overview](./overview)
- [Lifecycle and events](../lifecycle)
- [Architecture](../architecture#plugins)
