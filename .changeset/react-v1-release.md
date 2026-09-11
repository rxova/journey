---
"@rxova/journey-react": major
---

Replace the `1.0.0-rc.2` runtime-object React API with two twin bundle factories (linear and
graph) built on the final Core machine contract, plus a documented bring-your-own-machine pattern
over React's `useSyncExternalStore`.

## Linear factory API

- Add `createLinearJourney(definition, options?)`, the linear tier's single entry point and a
  structural twin of the graph factory. The definition is core's `LinearJourneyDefinition` shape —
  `context` (the initial value and the type anchor) plus ordered `steps` (bare-string shorthand or
  `{ id, metadata?, onEnter?, onLeave? }`, with an optional `name` used for the Provider's React
  DevTools displayName). Both type parameters are inferred from the one definition argument, so
  hooks and components need no generics at call sites.
- The factory creates **one standalone machine** and returns a bundle around it: `machine`,
  `Provider` (`views` + `children` only), `StepRenderer`, reactive hooks (`useSnapshot`,
  `useSelector`, `useStep`, `useContext`, `useSubscribeEvent`), stable accessors (`useMachine`,
  `useControls`, `useNavigation`), verbatim `navigate` / `updateContext` delegates callable outside
  React, and `useStepHandler(stepId, handler)` — per-step Core navigation work gating
  `goToNextStep`, whose `run` and transactional `commit` use the same machine-owned pending/error
  state as direct navigation.
- `views` is `{ [id in StepId]: ReactNode }`, exhaustively type-checked so a missing or undeclared
  key is a compile error (a `null` view is a legal render-nothing step; a missing key at runtime
  renders `StepRenderer`'s fallback). Machine options (`persist`, `plugins`, `autoStart`,
  `startAt`, `defaultTimeoutMs`, `onListenerError`) live in the factory's second argument, and
  `currentStep` is null while idle. `autoStart` is three-way in this tier — see the deferred-start
  entry below for the default and its SSR consequences.
- Hooks work with or without the Provider; the machine survives remounts and is never disposed by
  React — reset explicitly via `controls` (`terminate()` + `restart()`).
- Linear→graph migration is core's external `linearToGraphDefinition(definition)` from
  `@rxova/journey-core/convert`, applied to the same definition object the factory captured.

## Graph entry point and caller-owned machines

- Add `@rxova/journey-react/graph`. `createGraphJourney(definition, options?)` creates **one
  standalone machine in the factory** and returns a typed bundle around it: `machine`, `Provider`,
  `StepRenderer`, reactive hooks (`useSnapshot`, `useSelector`, `useStep`, `useContext`,
  `useSubscribeEvent`), stable accessors (`useMachine`, `useControls`, `useNavigation`), and
  verbatim `send` / `updateContext` delegates callable outside React. Hooks work with or without
  the Provider — the Provider only carries the `views` record (elements keyed exhaustively by step
  id, same contract as the linear tier) for `StepRenderer`. The machine survives remounts and is
  never disposed by React; `autoStart` behaves exactly as in the linear tier.
- There is no headless hook entry point. Caller-owned Core machines are consumed with React's own
  `useSyncExternalStore` over `machine.subscriptions` — the root package exports the structural
  types for it (`AnyJourneyMachine`, `SnapshotOf`, `ContextOf`, `StepIdOf`, `EventPayloadOf`).
- Keep `@rxova/journey-react/client` as the `"use client"` re-export of the root linear API. Both
  factories share one shape — a standalone machine per factory call, a views-only Provider, and a
  `StepRenderer` placed among ordinary siblings — differing only in their verbs (`navigate` +
  `useStepHandler` vs `send`).

## Migration

- Remove `createJourney`, `createJourneyFactory`, the returned bound runtime object,
  `JourneyProvider`, and their legacy hooks. Choose the linear factory for ordered wizards, the
  graph entry point for event-driven branching, or a caller-owned Core machine read through
  `useSyncExternalStore` when machine ownership and rendering must remain separate.
- Align all React snapshots, controls, navigation results, events, plugins, and graph definitions
  with the new Core V1 types. Graph custom events are discriminated `{ type; payload? }` unions.
- Make ownership explicit for SSR and React Server Component applications: every bundle factory
  creates a deliberate, visible module-scope machine; where per-request or per-mount isolation
  matters, own a Core machine yourself and read it with `useSyncExternalStore`.
- Require React `>=18.2.0`, `@rxova/journey-core` V1, and Node `>=20.11.0`.
- Rewrite the React documentation and examples around the two bundle factories and the
  caller-owned machine pattern.
