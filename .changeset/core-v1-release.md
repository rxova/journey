---
"@rxova/journey-core": major
---

Release the final V1 Core API on a new, smaller shared runtime. This is a full replacement of the
`1.0.0-rc.2` machine contract, not a compatible extension of it.

## Machine creation

- Replace the all-purpose `createJourneyMachine` factory with explicit `createLinearJourney` and
  `createGraphJourney` factories. Linear journeys use declared step order; graph journeys use
  declared event transitions.
- Replace `createJourneyBuilder` with `createGraphJourneyBuilder`. Its single `JourneyTypeBag`
  generic names `context`, `stepId`, `events`, optional `meta`, and optional `handlers` instead of
  relying on positional generic parameters.
- Add `normalizeGraphDefinition` and the `@rxova/journey-core/convert` entry point. Its
  `linearToGraphDefinition` helper converts a pure linear definition to `NEXT`/`PREVIOUS` graph
  transitions and can optionally generate `GO_TO_<ID>` jump events.
- Context is no longer restricted to a JSON object at the type level. Runtime consumers are still
  responsible for serializability where persistence or DevTools transport requires it.
- Add an explicit `engines.node >=20.11.0` package requirement.

## Machine contract

- Move commands into stable, purpose-specific namespaces:
  `machine.controls.{start,pause,resume,complete,terminate,restart}`,
  `machine.navigate.{goToStepById,goToPreviousStep,goToNextStep,goToLastVisitedStep}`,
  `machine.context.update`, `machine.async.clearError`, and
  `machine.subscriptions.{subscribeSelector,subscribeEvent}`.
- Lifecycle controls now return a boolean indicating whether the state change applied. Navigation
  methods and graph `send` return `Promise<NavigationResult>` with explicit failure reasons instead
  of relying on thrown errors or implicit no-ops.
- Rename lifecycle status `idled` to `idle`, add first-class `paused` state, make completion
  explicit, and store optional completion/termination payloads in `snapshot.outcome`.
- Default `autoStart` to `false`. `start()` is accepted only from `idle`; `restart()` is accepted
  only after completion or termination and restores the initial context and timeline. Termination
  wins over an in-flight transition.
- Remove `requireExplicitCompletion`, `onLifecycleError`, and `onListenerError` options. Completion
  is always explicit; work failures use navigation results and hook failures use typed error events;
  subscriber failures are isolated from the machine and reported through `console.error`.
- Make `dispose()` irreversible but safe: listeners are dropped and subsequent machine operations
  become no-ops or rejected results instead of throwing a dedicated disposed error.
- Replace broad, unfiltered event subscriptions and lifecycle-specific methods with typed
  `subscribeEvent(eventName, listener)`. Add optional selector equality to `subscribeSelector`.

## Snapshots, navigation, and hooks

- Replace the old computed/meta getters with immutable snapshots discriminated by
  `type: "linear" | "graph"`. Shared snapshot state now includes lifecycle flags, context,
  transition state, browser-like history, outcome, plugin extensions, and current-step async state.
- Linear snapshots expose declared order, position, first/last flags, and visit counts. Graph
  snapshots expose enabled `availableEvents`, enabled `availableSteps`, and terminal-step state.
- Use a browser-like timeline: moving backward or forward preserves existing entries, while a new
  navigation from the middle truncates the abandoned forward branch. Multi-step timeline jumps run
  leave/enter hooks once for the actual source and destination.
- Add transactional work to `goToNextStep` and `goToPreviousStep`. Its asynchronous `run` must
  succeed before movement; its synchronous `commit` stages context updates that publish atomically
  with the destination. Failure keeps both source and context unchanged and returns `reason: error`.
- Make `onLeave`, graph `onTransition`, and `onEnter` awaited post-commit effects. They run in that
  order, cannot roll navigation back, do not skip later effects after failure, and report failures
  through snapshot async state plus the typed `error` subscription event.
- Give hook arguments the current snapshot, source, destination, causing graph event, immediate
  `updateContext`, and FIFO `raise`. Raised graph events run only after the current transition
  settles and are capped by the exported `MAX_RAISED_EVENTS` guard. Hook context updates remain
  immediate side effects after commit.

## Graph events

- Define custom events as a discriminated union of `{ type; payload? }` values. Call graph
  `send(type, payload?)`; payload presence and type are inferred from the selected union member.
- Declare ordered transition candidates per event. Synchronous `when({ context, handlers })`
  guards select the first enabled candidate. Guards deliberately receive no event payload because
  they are also used to derive enabled events; asynchronous `onTransition` runs after commit and
  receives the causing event.
- Allow the definition's handler object to be replaced at machine creation through
  `createGraphJourney(definition, { handlers })`, so one definition can use production or test
  dependencies. This is a complete override, not a shallow merge.
- Return `no-enabled-transition` when an event has no matching enabled candidate. Self-transitions
  remain valid graph transitions and perform a real leave/re-entry.

## Plugins

- Replace intercepting controller plugins with observe-only `JourneyPlugin` instances. Each plugin
  receives a read-only `PluginHost` in `setup()` and may expose a namespaced API at
  `machine.plugins[name]` plus derived state at `snapshot.plugins[name]`.
- Scope mutable built-in plugin state to each `setup()` call, so reusing a plugin instance across
  multiple machines no longer shares replay buffers, timers, analytics events, or subscriptions.
- Rewrite persistence around `{ storage, key, clearOnTerminate?, now? }`. It stores status, context,
  timeline, pointer, and save time; exposes `inspectPersistedState`, `readPersisted`, and
  `clearPersisted`; and does not automatically hydrate a machine.
- Rewrite autosave as a debounced observer with required storage, configurable
  `context | transition | status` triggers, explicit idle/pending/saving/saved/error state, and
  `flushAutosave`, `clearAutosave`, and `readPersisted` APIs.
- Rewrite analytics around a safe `track` sink, optional `onError`, custom
  `trackAnalyticsEvent`, and a bounded 100-entry success/failure history.
- Rewrite diagnostics as cached structural analysis exposed by `getDiagnostics`, reporting
  unreachable steps, shadowed transitions, cycles, and missing terminal paths. Graph checks are
  explicitly skipped for linear journeys.
- Change execution paths from static graph enumeration to observed run history via
  `getCurrentPath` and `getCompletedPaths`.
- Rewrite replay as a bounded timestamped log of status, transition, context, blocked navigation,
  and error entries, with optional per-entry snapshots and JSON export.
- Add `@rxova/journey-core/subscription-enhancer` for filtered start, restart, complete, terminate,
  pause, and resume subscriptions without expanding the base machine surface.
- Export focused helper functions and associated types from the plugin subpaths for parsing,
  serialization, normalization, and diagnostics analysis.

The controller-per-concern engine and duplicated linear/graph derivation code were replaced by one
snapshot/event runtime. Current minified+Brotli measurements against the `rc.2` baseline are:

| Export                             | Before  | After   | Change |
| ---------------------------------- | ------- | ------- | ------ |
| `createLinearJourney`              | 9.35 kB | 3.77 kB | -60%   |
| `createGraphJourney`               | 9.98 kB | 3.93 kB | -61%   |
| `createPersistencePlugin`          | 3.58 kB | 413 B   | -88%   |
| `createExecutionPathsPlugin`       | 2.61 kB | 223 B   | -91%   |
| `createAutosavePlugin`             | 3.98 kB | 616 B   | -85%   |
| `createDiagnosticsPlugin`          | 3.19 kB | 702 B   | -78%   |
| `createAnalyticsPlugin`            | 1.24 kB | 377 B   | -70%   |
| `createGraphJourneyBuilder`        | 675 B   | 410 B   | -39%   |
| `createReplayPlugin`               | 816 B   | 686 B   | -16%   |
| `createSubscriptionEnhancerPlugin` | 168 B   | 175 B   | ~flat  |

Core documentation and runnable examples were rewritten around this final contract and its migration
path.
