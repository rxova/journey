---
id: plugin-host
title: Plugin host
---

# Plugin host

Plugins are initialized once, at machine creation, with an observe-only `PluginHost`. The host
exposes the current snapshot, a frozen structural view of the definition, observation taps, and
disposal registration:

```text
host
  getSnapshot()
  structure            kind, stepIds, initial, flattened transitions
  onTransition()       after commit + settle of every successful navigation
  onStepEnter() / onStepLeave()
  onStatusChange() / onContextChange()
  onNavigationBlocked() / onError()
  onDispose()
```

There is no interception in V1: plugins cannot block, redirect, or rewrite navigation, and they
cannot seed runtime state. Movement policy belongs in the definition.

## Contributions {#contributions}

A plugin's `setup(host)` may return:

- `api` — exposed at `machine.plugins[name]`;
- `deriveSnapshot(snapshot, previous)` — its result is exposed at `snapshot.plugins[name]`.

Extensions are always namespaced under the plugin's name, never merged into core fields. Duplicate
plugin names fail machine creation. Because `setup` runs once per machine, per-instance state lives
in the setup closure — reusing one plugin object across machines does not share buffers or timers.

## Referential stability {#referential-stability}

`deriveSnapshot` runs on every publish and receives its previous extension value. Returning
`previous` when nothing relevant changed keeps the extension referentially stable, so selectors
over `snapshot.plugins[name]` do not fire spuriously:

```ts
deriveSnapshot(snapshot, previous) {
  const next = { lastSavedAt };
  return previous && previous.lastSavedAt === next.lastSavedAt ? previous : next;
}
```

## Isolation {#isolation}

Plugin observer exceptions are caught and reported like any other listener failure (see
[Store — listener isolation](./store#listener-isolation)); a throwing plugin cannot interrupt a
transition.

## Where to next

- [Writing a plugin](../plugins/authoring)
- [Plugins overview](../plugins/overview)
- [Store](./store)
