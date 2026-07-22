---
"@rxova/journey-react": major
---

Replace the `1.0.0-rc.2` runtime-object React API with three explicit integration tiers built on the
final Core machine contract.

## Linear factory API

- Add `createLinearJourney(definition, options?)`, the linear tier's single entry point. The
  definition is core's `LinearJourneyDefinition` shape — `context` (the initial value and the type
  anchor) plus ordered `steps` (bare-string shorthand or `{ id, metadata?, onEnter?, onLeave? }`,
  with an optional `name` used for the Provider's React DevTools displayName). Both type parameters
  are inferred from the one definition argument, so hooks and components need no generics at call
  sites. No machine is created in the factory.
- The returned bundle is `{ Provider, useJourney, useSelector, useStep }`, each pre-bound to the
  definition's context and step-id types, with a private per-bundle React context: hooks from one
  bundle throw under another bundle's Provider.
- `<Provider>` renders steps from a `views` record — `{ [id in StepId]: ReactNode }`, exhaustively
  type-checked so a missing or undeclared key is a compile error (a runtime check backs plain-JS
  callers; a `null` view is a legal render-nothing step). Remaining props are React-side only:
  `header`, `footer`, `wrapper`, `fallback`, verbatim event callbacks (`onStart`, `onStepEnter`,
  `onStepLeave`, `onComplete`, `onError`), `machineRef`, and two mount-time overrides —
  `initialContext` (whole-object replacement of the definition context) and `startAt` (wins over
  the factory options' `startAt`). Machine options (`persist`, `plugins`, `autoStart`, `startAt`,
  `defaultTimeoutMs`, `onListenerError`) live in the factory's second argument, frozen per bundle.
- Each Provider mount owns one machine (StrictMode-safe, disposed on unmount); `autoStart` defaults
  to `true` and the start runs in a layout effect, so render is pure, the initial `stepEnter`
  reaches `onStepEnter`/`onStart`, and while idle only `fallback` renders — which is also what SSR
  emits.
- `useJourney()` returns the core machine and live snapshot verbatim; `useSelector` subscribes to a
  derived slice; `useStep` registers per-step Core navigation work before forward movement, whose
  `run` and transactional `commit` use the same machine-owned pending/error state as direct
  navigation.
- Linear→graph migration is core's external `linearToGraphDefinition(definition)` from
  `@rxova/journey-core/convert`, applied to the same definition object the factory captured.

## Graph and headless entry points

- Add `@rxova/journey-react/graph`. `createGraphJourney(definition, options?)` creates **one
  standalone machine in the factory** and returns a typed bundle around it: `machine`, `Provider`,
  `StepRenderer`, reactive hooks (`useSnapshot`, `useSelector`, `useStep`, `useContext`,
  `useSubscribeEvent`), stable accessors (`useMachine`, `useControls`, `useNavigation`), and
  verbatim `send` / `updateContext` delegates callable outside React. Hooks work with or without
  the Provider — the Provider only carries the `views` record (elements keyed exhaustively by step
  id, same contract as the linear tier) for `StepRenderer`. The machine starts by default
  (`autoStart: true` is the React-tier default), survives remounts, and is never disposed by React;
  per-mount or per-request isolation is the headless tier's job (`useOwnedJourney` + core's
  factory).
- Add `@rxova/journey-react/headless` for existing Core machines: `useOwnedJourney`,
  `useJourneySnapshot`, `useJourneySelector`, `useJourneyEvent`, `useJourneyStepLifecycle`, and
  `useStepAsyncState`. `useOwnedJourney(factory)` creates once, remains StrictMode-safe, and disposes
  its machine on unmount.
- Keep `@rxova/journey-react/client` as the `"use client"` re-export of the root linear API. Both
  factories render from a typed `views` record but differ in ownership on purpose: linear is
  React-owned (one machine per Provider mount), graph is machine-first (one standalone machine per
  factory call).

## Migration

- Remove `createJourney`, `createJourneyFactory`, the returned bound runtime object,
  `JourneyProvider`, and their legacy hooks. Choose the linear factory for ordered wizards, the
  graph entry point for event-driven branching, or the headless entry point when machine ownership
  and rendering must remain separate.
- Align all React snapshots, controls, navigation results, events, plugins, and graph definitions
  with the new Core V1 types. Graph custom events are discriminated `{ type; payload? }` unions.
- Make ownership explicit for SSR and React Server Component applications: the linear tier and
  headless owners never create module-level state, and the graph factory's standalone machine is a
  deliberate, visible module-scope singleton — use the headless tier where per-request isolation
  matters.
- Require React `>=18.2.0`, `@rxova/journey-core` V1, and Node `>=20.11.0`.
- Rewrite the React documentation and examples around the linear, graph, and headless ownership
  models.
