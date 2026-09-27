# @rxova/journey-react

## 1.0.0-rc.4

### Major Changes

- [#152](https://github.com/rxova/journey/pull/152) [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827) - **Breaking:** the React tier no longer starts the machine inside the factory by default. It now
  starts from a layout effect on first mount, so subscribers attach before the journey's first
  `stepEnter` — previously that event fired during `createLinearJourney()` / `createGraphJourney()`
  and was structurally impossible to observe through `useEventEffect`.

  `autoStart` becomes three-way in this tier:

  - **omitted (new default)** — the machine starts when the first Provider, reactive hook,
    `useEventEffect`, or `useStepHandler` mounts. `controls.start()` is idempotent, so mounting
    many components still starts it exactly once.
  - **`true`** — the previous behaviour: the machine starts eagerly inside the factory. Use it when
    the server must render step content, or when the bundle is driven entirely from non-React code.
  - **`false`** — unchanged: nothing starts until you call `controls.start()`.

  Consequences to check when upgrading:

  - **SSR now renders `fallback` by default.** Layout effects do not run on the server, so the
    machine is still idle there and both sides agree — which is what makes hydration deterministic.
    Pass `autoStart: true` to restore server-rendered step content.
  - **A bundle driven only from non-React code needs `autoStart: true`** (or an explicit
    `controls.start()`), because nothing ever mounts to start it.
  - **`useEventEffect` now receives the initial `stepEnter` and `statusChange`.** Listeners that
    assumed the first entry was already missed will see one more event than before.

- [#152](https://github.com/rxova/journey/pull/152) [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827) - Replace the `1.0.0-rc.2` runtime-object React API with two twin bundle factories (linear and
  graph) built on the final Core machine contract, plus a documented bring-your-own-machine pattern
  over React's `useSyncExternalStore`.

  ## Linear factory API
  - Add `createLinearJourney(definition, options?)`, the linear tier's single entry point and a
    structural twin of the graph factory. The definition is core's `LinearJourneyDefinition` shape —
    `context` (the initial value and the type anchor) plus ordered `steps` (bare-string shorthand or
    `{ id, metadata? }` — this tier declines Core's step lifecycle hooks, since a step's view mounts
    on enter and unmounts on leave — with an optional `name` used for the Provider's React
    DevTools displayName). Both type parameters are inferred from the one definition argument, so
    hooks and components need no generics at call sites.
  - The factory creates **one standalone machine** and returns a bundle around it: `machine`,
    `Provider` (`views` + `children` only), `StepRenderer`, reactive hooks (`useSnapshot`,
    `useSelector`, `useStep`, `useContextSelector`, `useEventEffect`), verbatim `controls` /
    `navigate` / `updateContext` delegates callable outside React, and `useStepHandler(stepId, handler)` — per-step Core navigation work gating
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

  ## Graph entry point and caller-owned machines
  - Add `@rxova/journey-react/graph`. `createGraphJourney(definition, options?)` creates **one
    standalone machine in the factory** and returns a typed bundle around it: `machine`, `Provider`,
    `StepRenderer`, reactive hooks (`useSnapshot`, `useSelector`, `useStep`, `useContextSelector`,
    `useEventEffect`), and verbatim `controls` / `send` / `updateContext` delegates callable outside
    React. Hooks work with or without
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

- [#152](https://github.com/rxova/journey/pull/152) [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827) - Leave one way to read and one way to command. The bundle exposed ten hooks; three of them were not
  reactive at all, and two more were second spellings of things that belong elsewhere.

  ## Renamed
  - `useSubscribeEvent` → **`useEventEffect`**. It is an effect that happens to subscribe, and the
    name now puts it next to `useEffect` in a reader's head rather than next to `machine.subscriptions`.
  - `useContext()` → **`useContextSelector(selector, equalityFn?)`**, selector required.
    `useContextSelector((context) => context)` is the explicit way to ask for the whole object and
    re-render on every context write — by construction rather than by accident.

  ## Removed

  `useMachine()`, `useControls()` and `useNavigation()` are gone. None of them subscribed to anything;
  each returned an object already reachable on the bundle. The machine's command groups are frozen
  objects with stable references, so they are plain properties now: `machine`, `controls`, `navigate`
  (linear) or `send` (graph), and `updateContext`.

  ## Step lifecycle hooks are effects

  React step configs no longer accept Core's `onEnter` / `onLeave`. `<StepRenderer>` keys the active
  view by step id, so a step's own component mounts when the step is entered and unmounts when it is
  left — a `useEffect` with a cleanup says both, scoped to the component that cares and able to reach
  component state and React context, which a hook running inside Core cannot.

  This is enforced, not just documented. The tier's step types declare `onEnter?: never` and
  `onLeave?: never`, because a bare `Omit` only rejects inline object literals: a step declared in its
  own file and annotated with Core's `GraphStep<Bag>` would otherwise keep its hooks and compile
  clean. Use `ReactLinearStepInput`, `ReactGraphStep<Bag>` and `ReactGraphDefinition<Bag>` where you
  would have reached for Core's equivalents. Core keeps both hooks for machines driven outside React.

  ## Unchanged, deliberately

  `autoStart` stays three-way in this tier — omitted starts the machine from a layout effect on first
  mount, so subscribers attach before the initial `stepEnter` and SSR renders `fallback` on both
  sides. Core's default is now `true`, which makes this tier's `options?.autoStart === true` guard
  load-bearing: forwarding options unchanged would start every bundle inside the factory and break
  hydration.

### Minor Changes

- [#152](https://github.com/rxova/journey/pull/152) [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827) - React review cleanups. Bundle `useSelector` hooks keep a single machine subscription across re-renders with inline selectors (the getter-side cache returns stable references).

- [#152](https://github.com/rxova/journey/pull/152) [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827) - Add `useJourney(factory)`, which owns a bundle for one component instance: the factory runs once,
  the bundle survives re-renders, and the machine is disposed when the component really unmounts.

  This replaces the `useState` lazy initializer the README previously recommended for per-mount
  isolation. React double-invokes those initializers under StrictMode, so that pattern built two
  fully-configured machines per mount — two plugin `setup()` passes, two persistence reads and
  writes, two armed autosave timers — and abandoned one without disposing it. `useJourney`
  initializes into a ref and defers disposal by a macrotask, so StrictMode's simulated unmount
  cancels it while a real unmount still disposes.

  Also exports the `OwnedJourneyBundle` type, and documents the lifecycle of module-scope bundles:
  they are never disposed, and one such bundle is shared by every request in a server process.

### Patch Changes

- [#152](https://github.com/rxova/journey/pull/152) [`e8d1669`](https://github.com/rxova/journey/commit/e8d16695ea4f7736defac9397d58cf1298b75dbd) - Documentation accuracy. The React docs described the API as it stood before deferred start and
  `useJourney` landed, so three of the corrections below are not stale phrasing but active
  misdirection.

  - **`autoStart` is documented as three-way**, matching what ships. The docs said it "defaults to
    `true`" in six places; the default is to start when the bundle's first Provider or hook mounts.
  - **`useJourney` is now taught in the narrative docs.** It was reachable only from the generated
    API reference, because the docs' banned-identifier check still listed `useJourney` as an rc-era
    name — the check was silently keeping the shipping API out of the documentation.
  - **The `useState` lazy-initializer pattern is no longer recommended for per-component ownership.**
    It was documented in full, including the claim that the machine "holds no global registrations or
    timers at rest" — which is false with `persist` or `autosave` configured. That pattern builds two
    machines per StrictMode mount and abandons one undisposed; `useJourney` exists to fix it.
  - **The root README's "React: headless hooks" section is gone.** It documented
    `@rxova/journey-react/headless`, an entry point that no longer exists, alongside `useApi`,
    `useLinearJourney`, and `<LinearJourney>`. Replaced with the linear bundle, the graph bundle,
    `useJourney`, and the caller-owned `useSyncExternalStore` pattern.

  - **The rc.2 → 1.0 migration guide's React section is rewritten.** Its "migrate to this" side
    taught a three-tier design that never shipped: `<LinearJourney>` with `LinearJourney.Step`
    children, `useLinearJourney`, and a `@rxova/journey-react/headless` entry point with
    `useOwnedJourney` and machine-argument hooks. It now describes the twin bundle factories,
    `useJourney` for per-component ownership, and the caller-owned `useSyncExternalStore` pattern,
    and it corrects the graph tier's ownership claim — the factory creates one machine, not one per
    Provider mount.

  The banned-identifier check now scans `README.md` and every `packages/*/README.md` in addition to
  the docs site. It already banned each removed identifier — the READMEs were simply never scanned,
  which is exactly how the headless section survived. The migration guide is deliberately exempt from
  that check, since it must name rc-era identifiers to teach the mapping; that exemption is also why
  its stale 1.0 side went unnoticed, so it is worth reading manually whenever the API moves.

- [#152](https://github.com/rxova/journey/pull/152) [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827) - Test-only. Covers three surfaces the package shipped without: the `./client` entry (previously
  verified only by a string match for its `"use client"` directive against the built bundle), error
  boundaries around `StepRenderer` and a throwing step view, and a suspending view inside
  `<Suspense>`.

  The client-entry test asserts its export surface matches the root entry, so a missing re-export
  fails here rather than in a consumer's app.

- [#152](https://github.com/rxova/journey/pull/152) [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827) - `createLinearJourney` now forwards the whole definition to core instead of hand-picking `steps`
  and `context`. Its own `name` field is rest-destructured off and the remainder is passed through,
  matching what the graph factory already did. The two are equivalent today, but the old shape would
  have silently dropped any field core added to the linear definition later.

- [#152](https://github.com/rxova/journey/pull/152) [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827) - Fix type resolution for consumers on `moduleResolution: "node16"` / `"nodenext"`. The published
  `.d.ts` and `.d.cts` files carried extensionless relative imports, which those resolvers cannot
  follow — all three entrypoints reported an internal resolution error. The published declarations
  now carry explicit `.js` extensions, added at build time.

  Also adds size budgets for the previously unmeasured `dist/client.js` and for `useJourney`.

- [#152](https://github.com/rxova/journey/pull/152) [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827) - The bindings no longer write refs during render. `useSelector`'s cache is rebuilt through
  `useMemo` per derivation, and the last committed selection now lives in a ref advanced from an
  effect — mirroring React's own `useSyncExternalStoreWithSelector`. The latest-ref assignments
  behind `useEventEffect` and `useStepHandler` moved into effects for the same reason.

  Previously a render that React started and then discarded could advance the baseline that
  `equalityFn` compares against, which with an identity-field equality could pin a stale value.
  Selected-reference stability across parent re-renders with inline selectors is unchanged.

  This also makes the package compatible with the React Compiler, and lets `react-hooks/refs` be
  enforced repo-wide rather than switched off.

- [#152](https://github.com/rxova/journey/pull/152) [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827) - A bundle now opens a single machine subscription for its whole component tree instead of one per
  mounted hook. Core runs every registered selector on every publish, so subscribing per hook made
  it repeat identical selector and equality work once per subscriber — five subscribed components
  meant five subscriptions and five times the per-publish cost. It is now constant regardless of
  how many views are mounted, and the subscription is released when the last one unmounts.

  The multiplexer and the selection cache moved to `@rxova/journey-common/bindings`, since both are
  pure logic a Vue or Angular wrapper would otherwise reimplement. No new published package: common
  is internal and bundled into the wrapper.

- [#152](https://github.com/rxova/journey/pull/152) [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827) - React 18.2 is now a verified minimum rather than an unverified claim. The peer range already said
  `>=18.2.0`, but only React 19 was ever installed or tested, and the README said 19 while
  `CONTRIBUTING.md` said 18+. All three now say 18.2+, and CI runs the React suite and a typecheck
  against React 18.2 alongside the default 19.

  One development-only difference is documented rather than papered over: React 18's StrictMode
  re-mounts hooks on its second render pass, so `useJourney()`'s factory runs twice there and once
  on React 19. Only the committed bundle is ever started — the discarded one never mounts, so its
  start effect never runs and it holds no timers, subscriptions, or journey state.

- Updated dependencies [[`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`3893a1b`](https://github.com/rxova/journey/commit/3893a1b491083c276c97eaeb0f1fffae12f2961c), [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827)]:
  - @rxova/journey-core@1.0.0-rc.4

## 1.0.0-rc.3

### Patch Changes

- [#131](https://github.com/rxova/journey/pull/131) [`5a7c344`](https://github.com/rxova/journey/commit/5a7c344d219cc24b4c2b3bf7ee3c1039a129045e) - Broaden the npm keywords

  Adds `multi-step-form`, `wizard-hook`, `onboarding` and `checkout-flow` — the
  searches somebody runs before they know a flow runtime is what they want — plus
  `use-journey` and `provider` for the surface they will actually type, and
  `headless`, which is the property that decides whether these bindings fit a
  design system already in place. No code changes.

- Updated dependencies [[`5a7c344`](https://github.com/rxova/journey/commit/5a7c344d219cc24b4c2b3bf7ee3c1039a129045e)]:
  - @rxova/journey-core@1.0.0-rc.3

## 1.0.0-rc.2

### Patch Changes

- 5bc391a: Remove `JourneyProvider` lifecycle callback props in favor of event subscriptions and hooks.
- 4a16dd2: Rename the React startup API from `start()` to `startJourney()`.
- 882d5a5: Add useStepApi for step-scoped custom event sends.
- Updated dependencies [5bc391a]
- Updated dependencies [4a16dd2]
- Updated dependencies [a558001]
- Updated dependencies [87a83d7]
- Updated dependencies [882d5a5]
- Updated dependencies [b95191f]
- Updated dependencies [ada8084]
- Updated dependencies [29f008d]
  - @rxova/journey-core@1.0.0-rc.2

## 1.0.0-rc.1

### Major Changes

- 1cdde02: ## Breaking changes

  ### `createJourney()` replaces `createJourneyBindings()`

  The previous context-based bindings factory, root-level `JourneyProvider`, `JourneyRenderer`, and
  provider-free hook exports have been removed in favor of the new machine-first runtime API.

  ### Provider-owned journeys start in layout phase

  `JourneyProvider` now calls `machine.startJourney()` in a layout effect so the journey is running before
  first paint.

  ### Re-exported runtime constants removed

  `JOURNEY_STATUS`, `JOURNEY_EVENT`, `JOURNEY_ASYNC_PHASE`, and `JOURNEY_WILDCARD` are no longer
  re-exported from `@rxova/journey-react`.

  ### `JourneyApi` return types changed

  `clearStepError`, `updateContext`, and `updateStepMetadata` now return `JourneySnapshot` instead
  of `void`.

  ### Aligned with the new core transition, status, and type model

  React journey definitions now use the declarative graph or linear syntax, the simplified
  4-parameter `JourneyDefinition`, and the new past-tense status / event names.

  ## Added

  ### `useJourneyComputed()`

  Exposes `machine.getComputed()` as a hook with snapshot-driven re-rendering.

  ### `useJourneySelector(selector, equalityFn?)`

  Subscribes to a derived slice of the snapshot with optional custom equality.

  ### `useJourneyApi().goToStepById(stepId)`

  Adds the convenience navigation API that maps to the core `goToStepById` event.

  ### `useJourneyStepLifecycle(stepId, { onEnter?, onLeave? })`

  Runs side effects when a specific step is entered or left while always calling the latest
  callbacks.

  ### `@rxova/journey-react/client`

  Adds an explicit client-marked subpath for Next.js App Router boundaries while keeping the root
  entry server-safe.

  ## Changed
  - `JourneyProvider` disposal is now opt-in via `disposeOnUnmount`
  - `JourneyProvider` reports provider-owned startup failures through `onError(error, { phase: "startJourney" })`
  - `updateContextQueued()` has been removed; use `updateContext()` from `useJourneyApi()` instead
  - React stays aligned with the core timeout support and runtime refactors

### Patch Changes

- Updated dependencies [1cdde02]
  - @rxova/journey-core@1.0.0-rc.1

## Unreleased

### Patch Changes

- `StepRenderer` and `JourneyProvider` status tracking now subscribe through selectors so unrelated snapshot updates no longer rerender those paths.
- `useJourneyApi()` now includes `startJourney()` to match the core machine control surface.
- React tests now cover inline selector usage, `startTransition` read consistency, and hook behavior after runtime disposal.

## 0.7.0

### Minor Changes

- 239f7c5: ## What changed
  - `useJourneyApi()` now returns real `JourneySendResult`s from `send`, `goToNextStep`, `completeJourney`, `terminateJourney`, and the other navigation helpers instead of only returning `Promise<void>`.
  - That aligns React with the new core error model: fire-and-forget calls like `void api.goToNextStep()` no longer surface unhandled promise rejections when guards or effects fail, because failures now come back on `result.error`.
  - A new `useJourneySelector(selector, equalityFn?)` hook was added on top of the new core selector subscription primitive, letting components subscribe to a derived slice and skip rerenders when unrelated snapshot fields change.
  - A new `useJourneyEvent(listener)` hook was added so bindings users can consume typed lifecycle telemetry without manually wiring `machine.subscribeEvent(...)`.
  - Provider lifecycle handling is now explicit. `JourneyProvider` still auto-starts an `idled` machine, but disposal is opt-in through `disposeOnUnmount`, so shared runtimes survive provider unmounts by default.
  - Provider no longer resets its internal machine just because the `persistence` prop identity changes. For apps that depended on the old behavior, `resetOnPersistenceChange` was added as the explicit opt-in path.
  - Provider also now accepts `requireExplicitCompletion`, plus `onStart`, `onComplete`, and `onTerminate` callbacks that wrap the new core lifecycle subscriptions for both internal and external machines.
  - `useJourneySnapshot()` now binds `subscribe` and `getSnapshot` before handing them to `useSyncExternalStore`, fixing compatibility with external machine wrappers whose methods rely on `this`.
  - `StepRenderer` now remounts by `currentStepId`, which matters when different steps intentionally share the same React component but should not share local component state.
  - The old `updateComponentMetadata` alias was removed from both the exported API type and the runtime object returned by `useJourneyApi()`. `updateStepMetadata` is now the single supported name.
  - React docs, examples, and tests were refreshed around selector subscriptions, event subscriptions, provider edge cases, StrictMode stability, and the updated result-returning API shape.

  ## Breaking changes
  - `updateComponentMetadata` was removed from `JourneyApi` and from the `useJourneyApi()` runtime object. Consumers must call `updateStepMetadata` instead.
  - Provider no longer resets its internal machine just because the `persistence` prop identity changed. If your app relied on that implicit reset, you now need `resetOnPersistenceChange`.

### Patch Changes

- Updated dependencies [239f7c5]
  - @rxova/journey-core@0.7.0

## 0.6.4

### Patch Changes

- 4ee201f: Per-package patch notes:
  - `@rxova/journey-devtools-bridge`
    - Guarded bridge transport posting with a safe `try/catch` so `window.postMessage` failures are swallowed.
    - Prevents bridge lifecycle/command flows from throwing when browser messaging is unavailable or rejects.
  - `@rxova/journey-react`
    - Memoized provider context value in `Provider` to keep stable references when `machine`/`journey` inputs are unchanged.
    - Reduces unnecessary rerenders for memoized consumers during unrelated parent rerenders and StrictMode churn.
  - `@rxova/journey-core`
    - Added listener-churn edge coverage to verify snapshot/event subscriptions are fully removed after unsubscribe.
    - Hardens regression protection around subscription retention behavior.

- Updated dependencies [4ee201f]
  - @rxova/journey-core@0.6.4

## 0.6.3

### Patch Changes

- 99a6635: Added a new public API TSDoc quality gate (docs:api:check) that verifies callable exports from package entrypoints have TSDoc summaries.
  - Enforced that check in CI/docs workflows and documented it in contributor/docs guides.
  - Added the checker implementation and comprehensive tests for pass/fail/CLI behavior.
  - Added/updated TSDoc on key public exports:
    - core transition builders (tx, createTransitions)
    - react bindings factory (createJourneyBindings)
    - devtools bridge attach + protocol envelope/command validators
  - No runtime behavior changes; this branch is primarily API documentation quality/tooling hardening.

  @rxova/journey-core
  - Added TSDoc summaries for public transition helpers (tx, createTransitions).
  - Added tests for the new API TSDoc checker (check-public-api-tsdoc) under core tests.
  - No runtime behavior changes.

  @rxova/journey-react
  - Added a TSDoc summary for createJourneyBindings (public React API entrypoint helper).
  - No runtime behavior changes.

  @rxova/journey-devtools-bridge
  - Added TSDoc summaries for public bridge/protocol APIs (attachJourneyDevtools and envelope/command validators).
  - No runtime behavior changes.

  apps-docs
  - Documented the new API docs quality gate (pnpm run docs:api:check) in the docs README.
  - No end-user docs content changes beyond contributor/developer guidance.

  repo/tooling (cross-package)
  - Added docs:api:check script to root package.json.
  - Added scripts/check-public-api-tsdoc.ts to enforce TSDoc coverage on public callable exports.
  - Wired this check into CI/docs workflows and contributing guidelines.

- Updated dependencies [99a6635]
  - @rxova/journey-core@0.6.3

## 0.6.2

### Patch Changes

- 6a38c50: - Tightened core machine typing by introducing JourneySendEvent and removing unsafe as unknown/as never casts in convenience APIs.
  - Replaced JourneyStepDefinition’s open Record<string, unknown> escape hatch with explicit typed step extensions.
  - Added runtime validation in devtools bridge for command stepId values (goToStepById, updateStepMetadata, clearStepError), returning commandError for unknown steps.
  - Added/updated tests for type coverage and bridge invalid-step behavior.
  - Added JSDoc to key public core types (including transition/event builder generics) and improved type readability with
    JourneyGoToStepByIdEventType.
- Updated dependencies [6a38c50]
  - @rxova/journey-core@0.6.2

## 0.6.1

### Patch Changes

- 7be5e0c: minor updates
  - adds shell header + set -e to Husky hooks,
  - fixes test fixture newline escaping,
  - adds explanatory comment before "use client",
  - tiny docs visual tweak.

- Updated dependencies [7be5e0c]
  - @rxova/journey-core@0.6.1

## 0.6.0

### Minor Changes

- 56234c2: Improve docs across Core, React, and Devtool Bridge, including API restructuring, clearer runtime semantics references, and TypeScript-focused guidance.

### Patch Changes

- Updated dependencies [56234c2]
  - @rxova/journey-core@0.6.0

## 0.5.0

### Minor Changes

- 16db5e3: Journey 0.5.0 is a full platform-level upgrade across core runtime, React bindings, and devtools.
  This 0.5.0 release focuses on deterministic flow behavior, stronger typing, cleaner APIs, and
  better observability/debuggability.

  ## `@rxova/journey-core`

  ### New and improved
  - New canonical snapshot shape with `history.timeline` + `history.index` pointer model.
  - Deterministic pointer navigation APIs: `goToPreviousStep(steps?)`, `goToLastVisitedStep()`.
  - Convenience helpers: `goToNextStep()`, `completeJourney(payload?)`, `terminateJourney(payload?)`.
  - Built-in fallback semantics for `back`/`goToPreviousStep` event sends when no explicit transition matches.
  - Strongly typed transition builder ergonomics via `createTransitions` and `tx` helpers (`toComplete`, `toTerminate`, branching builders).
  - First-match-wins transition execution preserved and clarified for reliability.
  - Typed async transition phases exposed in snapshot: `idle`, `evaluating-when`, `error`.
  - Metadata is now first-class at runtime via `snapshot.stepMeta` and `updateStepMetadata(stepId, updater)`.
  - Typed observability stream via `subscribeEvent(...)` with lifecycle/navigation/metadata events.
  - Expanded persistence model with versioning/migration support and safer hydration of invalid data.

  ### Breaking changes
  - v1 top-level `timeline` / `index` snapshot fields removed.
  - `HISTORY_TARGET` removed.
  - Legacy history helpers removed (`trimHistory`, `clearHistory`, overflow options).
  - Persistence now targets v2 snapshot structure and should be migrated with `migrate(...)` when needed.

  ## `@rxova/journey-react`

  ### New and improved
  - Bindings-first architecture is now the default.
  - `createJourneyBindings(journey)` returns typed `Provider`, `StepRenderer`, `useJourneyApi`, `useJourneySnapshot`, and `useJourneyMachine`.
  - Journey typing is captured once at bindings creation time; hook callsites no longer need per-call generics.
  - `useJourneyApi()` now delegates to machine-level navigation helpers (`goToNextStep`, `completeJourney`, `terminateJourney`, pointer APIs).
  - Imperative jumps remain available using event send: `api.send({ type: "goToStepById", stepId })` and `api.send({ type: "goToStepById", stepId, payload })`.
  - `resetOnJourneyChange` behavior is explicitly supported for intentional machine resets when journey definition identity changes.

  ### Breaking changes
  - Legacy global React hooks/components API removed in favor of bindings-first usage.
  - `goToStepById(...)` is no longer a dedicated `useJourneyApi` helper; use `api.send({ type: "goToStepById", ... })`.
  - Existing apps that called old global hooks/components or helper methods must migrate to bindings APIs.

  ## `@rxova/journey-devtools-bridge`

  ### New and improved
  - Protocol remains version `3` (no protocol version bump in this release).
  - Richer command set for runtime control: `goToNextStep`, `terminateJourney`, `completeJourney`, `goToStepById`, `goToPreviousStep`, `goToLastVisitedStep`, `updateStepMetadata`, `send`, `resetJourney`, `clearStepError`.
  - Snapshot payloads now include full v2 runtime state: `currentStepId`, `history.timeline`, `history.index`, `context`, `visited`, `stepMeta`, `status`, `async`.
  - Safer runtime defaults: bridge enabled by default in non-production; disabled by default in production unless explicitly enabled; commands disabled by default in production unless explicitly enabled.

  ### Breaking changes
  - Consumers should align command/snapshot assumptions with current protocol v3 shape.
  - Tooling relying on old snapshot/history shape must migrate to `history.timeline` and `history.index`.

  ## Migration checklist
  - Update core snapshot reads from v1 fields to v2 fields (`snapshot.timeline` -> `snapshot.history.timeline`, `snapshot.index` -> `snapshot.history.index`).
  - Replace removed history APIs (`trimHistory`, `clearHistory`, overflow options) with pointer navigation APIs.
  - Migrate persisted snapshots to v2 shape (or provide `persistence.migrate`).
  - Move React usage to bindings-first patterns (`createJourneyBindings` + bound hooks/components).
  - Replace `api.goToStepById(...)` calls with `api.send({ type: "goToStepById", ... })`.
  - Update devtools integrations to current protocol v3 command/snapshot structures.

  ## Notes
  - This release is intentionally comprehensive and includes updated docs, examples, devtools integration notes, and test coverage for the new model.
  - Package versions are set to `minor` so the fixed published package group bumps from `0.4.0` to `0.5.0`.
  - App package versions are also aligned to `0.5.0` for `apps-docs` and `apps-devtools`.

### Patch Changes

- Updated dependencies [16db5e3]
  - @rxova/journey-core@0.5.0

## 0.4.0

### Minor Changes

- 176007f: - Added full Chrome DevTools extension app
  - Added new bridge package with protocol + bridge runtime.
  - Added/expanded demo integration to exercise DevTools + bridge flows.
  - Added Devtool documentation section.
  - Updated docs UX in index.tsx, sidebars.ts, and search styling in styles.module.css.
  - Added CI/CD workflows for docs/devtools and Chrome Web Store publishing in devtools.yml, devtools-publish.yml, docs.yml.
  - Updated release/versioning config in config.json and scripts in package.json (pnpm run releases).
  - Updated README files across packages.

### Patch Changes

- @rxova/journey-core@0.4.0

## 0.3.0

### Minor Changes

- a3a8ea0: fix: keep visited independent of history trimming and persist it across hydrates

### Patch Changes

- Updated dependencies [a3a8ea0]
  - @rxova/journey-core@0.3.0

## 0.2.0

### Minor Changes

- 9cb812c: # Add history management and trimming controls
  - Core: `history` options with `maxHistory`, `onOverflow`, and manual `trimHistory`/`clearHistory`.
  - React: pass `history` options through `<JourneyProvider>` and expose trim/clear in `useJourney` API.
  - Docs: clarify history/visited behavior and overflow reasons.

### Patch Changes

- Updated dependencies [9cb812c]
  - @rxova/journey-core@0.2.0
