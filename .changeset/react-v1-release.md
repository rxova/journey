---
"@rxova/journey-react": major
---

Replace the `1.0.0-rc.2` runtime-object React API with three explicit integration tiers built on the
final Core machine contract.

## Linear component API

- Add the root `LinearJourney` component and `LinearJourney.Step`. Direct children define the
  ordered step list through unique `id` props; fragments are flattened, and the list is derived once
  per mount so conditional child changes cannot mutate a running machine definition. An inline
  `id` is consumed by Journey and stripped before rendering the child component.
- Augment React's global `Attributes` type with optional `id`, allowing any component element to
  declare its step id without adding `id` to that component's own props. Projects importing the
  root package will see this type augmentation globally.
- Add render configuration for context, initial step/index, header, footer, wrapper, fallback,
  lifecycle callbacks, persistence, plugins, and an imperative machine ref. A mounted linear
  component owns and disposes its machine.
- Add `useLinearJourney` for snapshot-derived position, visit, lifecycle, navigation, control,
  context, metadata, and machine access. Add `useLinearJourneySelector` for focused subscriptions
  and `useLinearJourneyStep` for per-step Core navigation work before forward movement. Its `run`
  and transactional `commit` use the same machine-owned pending/error state as direct navigation.
- Add the types-only curried `createLinearJourney<TContext>()([stepIds])` helper. It returns a typed
  `LinearJourney`, attached `LinearJourney.Step`, hooks, and `toGraphDefinition` bundle; it does not
  create or share a machine.

## Graph and headless entry points

- Add `@rxova/journey-react/graph`. `createGraphJourney(definition, options?)` returns a typed
  `Provider`, `StepRenderer`, `useSnapshot`, `useSelector`, `useApi`, `useStepAsyncState`,
  `useEvent`, `useStepLifecycle`, and `useMachine` bundle. Every Provider mount creates an isolated
  machine, applies an optional context override, starts by default, and disposes on unmount.
- Add `@rxova/journey-react/headless` for existing Core machines: `useOwnedJourney`,
  `useJourneySnapshot`, `useJourneySelector`, `useJourneyEvent`, `useJourneyStepLifecycle`, and
  `useStepAsyncState`. `useOwnedJourney(factory)` creates once, remains StrictMode-safe, and disposes
  its machine on unmount.
- Keep `@rxova/journey-react/client` as the `"use client"` re-export of the root linear API.

## Migration

- Remove `createJourney`, `createJourneyFactory`, the returned bound runtime object,
  `JourneyProvider`, and their legacy hooks. Choose `LinearJourney` for component-defined wizards,
  the graph entry point for definition-driven rendering, or the headless entry point when machine
  ownership and rendering must remain separate.
- Align all React snapshots, controls, navigation results, events, plugins, and graph definitions
  with the new Core V1 types. Graph custom events are discriminated `{ type; payload? }` unions.
- Make ownership safe for SSR and React Server Component applications: no API creates a module-level
  singleton implicitly, and Provider/owner mounts do not share runtime state.
- Require React `>=18.2.0`, `@rxova/journey-core` V1, and Node `>=20.11.0`.
- Rewrite the React documentation and examples around the linear, graph, and headless ownership
  models.
