---
"@rxova/journey-core": major
---

Close four gaps in the V1 type surface. Each would have needed a major release to correct once
`1.0.0` froze the exported types.

- **`createGraphJourney` now carries `THandlers` in its return type.** The declared return omitted
  the generic, so the annotation won over the widening cast and `args.handlers` inside send work
  resolved to `unknown` — even though that channel is the only way injected clients reach the
  work. Handlers supplied on the definition, or overridden at creation, are now typed at the call
  site.
- **Graph journeys can type their completion and termination payloads.** `GraphSnapshot` already
  had the slots; nothing filled them, so `controls.complete(anything)` compiled and
  `snapshot.machine.outcome` was `JourneyOutcome<unknown, unknown>`. Name the payloads through the
  definition's `$payloads` phantom carrier, alongside the existing `$events`:

  ```ts
  createGraphJourney({
    steps: { review: {}, done: {} },
    initial: "review",
    context: {},
    transitions: { CONFIRM: { from: "review", to: "done" } },
    $payloads: {} as { complete: Receipt; terminate: "cancelled" }
  });
  ```

  `JourneyTerminationPayloads`, `CompletePayloadOf`, and `TerminatePayloadOf` moved from the linear
  types to the shared core types, since both tiers name them now. They are re-exported from their
  previous location, so existing imports keep working.

- **`normalizeGraphDefinition` is no longer exported.** Its return type named `RuntimeStep` and
  `RuntimeTransition`, which are internal and have no export path, so publishing it would have
  frozen those shapes into the semver contract. It remains available internally to the factories
  and the diagnostics plugin. Relatedly, `GraphJourneyDefinition.eventWork` is now typed
  `Readonly<Record<string, unknown>>` and marked `@internal`: its keys are a private encoding of
  the (origin step, event) pair. Pass it back to a factory; never construct or read it.

- **`machine.plugins` rejects undeclared names on linear journeys.** `createLinearJourney`
  defaulted `TPlugins` to `readonly AnyJourneyPlugin[]`, which collapsed `PluginApis` to an index
  signature accepting any key — so `machine.plugins.anyTypoAtAll` compiled clean whenever plugins
  were omitted or the leading generics were supplied explicitly. It now defaults to `readonly []`,
  matching `createGraphJourney`.

  One consequence worth knowing: the creation-time `persist` option registers the persistence
  plugin at runtime but is not reflected in `TPlugins`, so `machine.plugins.persistence` is not
  statically reachable through that option. Pass `createPersistencePlugin` explicitly when you need
  the API typed.
