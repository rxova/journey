# RFC 0001 — Three-Tier React API: `<Wizard>`, Graph, Headless

- **Status:** **Superseded by [RFC 0003](./0003-react-standalone-bundles.md) (2026-07-22) for the React tier.** Historical from here on: the shipped design reversed this document's headline API, its headless tier, its per-Provider graph machine, and its SSR stance, and the "Shipped divergences" block below is itself stale. Read RFC 0003 for the contract. Retained because §3.12's verbatim-wrapper rule and its start-out-of-construction requirement survive, and because the motivation in §1 still explains why the redesign happened.
- **Branch:** `feat/react-api-redesign`
- **Date:** 2026-07-14 (accepted 2026-07-19)
- **Scope:** `@rxova/journey-react` (full redesign), `@rxova/journey-core` (snapshot family + three small additions), `@rxova/journey-devtools-bridge` (type-aware presentation)

## Shipped divergences (2026-07-19)

The implementation is the contract; where this document's sketches differ, the shipped code
deliberately superseded them:

- **Dynamic children (§3.6):** the sketched "machine transplant" for a changed step list was not
  shipped. The linear tier freezes the derived step list at mount and raises a dev-mode error when
  it changes, directing dynamic flows to the graph tier.
- **Naming:** every `Wizard` name shipped as `LinearJourney` (`<LinearJourney>`,
  `useLinearJourney`, `useLinearJourneyStep`, `createLinearJourney`); the module folder is
  `src/linear/`.
- **Hook result (§3.12):** `useLinearJourney()` returns the verbatim `{ machine, snapshot }` pair;
  the earlier flat ~25-field result described in pre-§3.12 sections is gone.
- **Pause/resume:** shipped as core `controls.pause()` / `controls.resume()` (with a `paused`
  status and `machine.isPaused`), not as `pauseJourney()` / `resumeJourney()` machine methods.
- **Graph bundle surface (§4):** the sketched `useStepApi` and `useComputed` hooks were not
  shipped. The bundle exposes `Provider`, `StepRenderer`, `useSnapshot`, `useSelector`, `useApi`
  (`{ controls, navigate, send, updateContext }`), `useStepAsyncState`, `useEvent`,
  `useStepLifecycle`, and `useMachine`.
- **File layout (§9):** shipped as `linear/` + `headless/` + `graph/` with per-hook files, not the
  predicted `wizard/` layout.

---

## 1. Summary & Motivation

Journey's React surface is overcomplicated. Building a plain linear wizard today requires:

1. a module-scope factory call (`createLinearJourney({ context, steps })`),
2. a separate `views: Record<StepId, ComponentType>` map,
3. `<journey.JourneyProvider views={views}>` + `<journey.StepRenderer />`,
4. runtime-object-scoped hooks (`journey.useJourneySnapshot()`, `journey.useJourneyApi()`).

Compare react-use-wizard, where the entire program is:

```tsx
<Wizard>
  <Step1 />
  <Step2 />
</Wizard>
```

plus a `useWizard()` hook. Journey's linear experience visibly _is_ an adapted graph API — the ceremony serves the engine, not the user. Since we are pre-1.0 (`1.0.0-rc.2`), we can break everything and get this right.

This RFC replaces the current runtime-object API with **three deliberately distinct surfaces** that share one snapshot _family_ (a discriminated union with a common base — see §6), while each tier is free to have the runtime it needs:

| Tier         | Import                          | Shape                         | Audience                                            |
| ------------ | ------------------------------- | ----------------------------- | --------------------------------------------------- |
| **Linear**   | `@rxova/journey-react`          | `<Wizard>` + `useWizard()`    | The 90% case; must beat react-use-wizard in comfort |
| **Graph**    | `@rxova/journey-react/graph`    | `createGraphJourney()` bundle | Non-linear flows; ceremony is the point             |
| **Headless** | `@rxova/journey-react/headless` | machine-argument hooks        | Full control; bring your own machine                |

## 2. Fixed constraints (owner decisions)

1. React is first-class. Core stays the framework-agnostic engine (Angular/Vue later).
2. Three tiers, each with its own API. Linear→graph migration via a helper and/or codemod.
3. Linear and graph have **separate snapshot types**, discriminated by a new `type: "linear" | "graph"` field (headless uses `"graph"`). They are NOT required to be 100% identical, but must stay as structurally close as possible — especially `history`, `visited`, `status`, `context`, and step-metadata access. Two separate runtimes are explicitly acceptable. Devtools discriminate on `type`.
4. The current runtime-object API is **deleted**. No deprecation period.
5. Linear supports **both** forms: steps as bare children of `<Wizard>` AND a steps-object prop for programmatic manipulation.
6. Step ids are **mandatory and unique**. Children form: `id` prop on the child or a `<Wizard.Step id>` wrapper (both accepted). Object form: the object keys.
7. Zero-factory `<Wizard>` + package-level `useWizard()` is the headline; `createWizard()` is the optional fully-typed escape hatch.
8. Existing method naming is kept everywhere (`goToNextStep`, `goToPreviousStep`, `resetJourney`, `isFirstStep`, …). Two new core methods: `pauseJourney()` / `resumeJourney()` with a transient (non-persisted) `isPaused` flag.
9. Shared cross-component state is **core context** — typed, in the snapshot — never React state.

## 3. Tier 1 — Linear: `<Wizard>` / `useWizard()`

### 3.1 The headline

```tsx
import { Wizard, useWizard } from "@rxova/journey-react";

const App = () => (
  <Wizard header={<Progress />} footer={<Nav />}>
    <Email id="email" />
    <Password id="password" />
    <Confirm id="confirm" />
  </Wizard>
);

const Nav = () => {
  const { goToNextStep, goToPreviousStep, isFirstStep, isLastStep, isLoading } = useWizard();
  return (
    <div>
      <button disabled={isFirstStep} onClick={() => void goToPreviousStep()}>
        Back
      </button>
      <button disabled={isLoading} onClick={() => void goToNextStep()}>
        {isLastStep ? "Finish" : "Next"}
      </button>
    </div>
  );
};
```

That is the whole program. No factory, no views map, no provider, no dispose. The machine is created when `<Wizard>` mounts and disposed when it unmounts (StrictMode-safe, see §3.10).

### 3.2 `WizardProps`

```ts
type WizardProps<TContext extends JourneyJsonObject = JourneyEmpty> = {
  /** Children form: each child element is a step. Mutually exclusive with `steps`. */
  children?: React.ReactNode;
  /** Object form: keys are step ids, insertion order is step order. */
  steps?: WizardStepsProp<TContext>;

  /** Initial shared state. Lives in the core machine, not in React. See §3.7. */
  context?: TContext;
  startIndex?: number; // default 0
  startStepId?: string; // wins over startIndex; dev-mode error if both are set

  /** Rendered above/below the active step, INSIDE the wizard context — both may call useWizard(). */
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /** The active step is cloned into this element (e.g. <AnimatePresence>). */
  wrapper?: React.ReactElement<{ children?: React.ReactNode }>;
  /** Shown when no step can render yet (e.g. awaiting persisted rehydration, see §3.11). */
  fallback?: React.ReactNode;

  onStepChange?: (change: WizardStepChange<TContext>) => void;
  /** Global lifecycle callbacks; fire for every step, alongside per-step onEnter/onLeave. */
  onStepEnter?: (args: { stepId: string; context: TContext }) => void;
  onStepLeave?: (args: { stepId: string; context: TContext }) => void;
  onComplete?: (args: {
    context: TContext;
    snapshot: LinearJourneySnapshot<TContext, string>;
  }) => void;
  onError?: (error: unknown, info: { phase: "start" | "navigate" | "step-handler" }) => void;

  /** Sugar over the core persistence plugin. */
  persist?: WizardPersistProp;
  plugins?: readonly JourneyMachinePlugin[];
  handlers?: Record<string, unknown>;
  requireExplicitCompletion?: boolean;
  /** Imperative escape hatch to the underlying core machine. */
  machineRef?: React.Ref<LinearJourneyMachine<TContext, string>>;
};

type WizardStepChange<TContext> = {
  fromStepId: string | null;
  toStepId: string;
  fromIndex: number | null;
  toIndex: number;
  direction: "forward" | "backward" | "jump";
  context: TContext;
};

type WizardPersistProp = {
  key: string;
  storage?: JourneyPersistenceStorage; // default: localStorage adapter
  version?: number;
  migrate?: JourneyPersistenceMigrate;
};
```

`header` / `footer` / `wrapper` / `startIndex` are deliberate 1:1 answers to react-use-wizard's props, so migration from it is mechanical.

Setting both `children` and `steps` is a dev-mode error.

### 3.3 Steps-object form

For programmatic manipulation (building steps from data, filtering, reordering), pass components as an object. Keys become step ids; JS insertion order defines step order (documented guarantee). Values are bare components or a full config object:

```tsx
<Wizard
  context={{ email: "" }}
  steps={{
    login: Login, // shorthand
    verify: {
      // full config
      component: Verify,
      meta: { title: "2FA" },
      onEnter: ({ context }) => track(context)
    }
  }}
/>
```

```ts
type WizardStepConfig<TContext extends JourneyJsonObject> = {
  component: React.ComponentType;
  meta?: JourneyJsonValue;
  onEnter?: JourneyStepLifecycleCallback<TContext, string, never>;
  onLeave?: JourneyStepLifecycleCallback<TContext, string, never>;
  effect?: JourneyStepEffect<TContext, string>;
  after?: Record<number, JourneyAfterTransition<TContext, string>>;
};

type WizardStepsProp<TContext extends JourneyJsonObject> = Record<
  string,
  React.ComponentType | WizardStepConfig<TContext>
>;
```

This maps 1:1 onto core's `LinearJourneyStep` object entries (`packages/core/src/types/journey.types.ts`), which already accept `meta` / `onEnter` / `onLeave` / `effect` / `after` — no core change needed.

### 3.4 Children form — two spellings, mixable

**Simple — an `id` prop on the child element:**

```tsx
<Wizard>
  <Login id="login" />
  <Verify id="verify" />
</Wizard>
```

`Wizard` reads `element.props.id` and **strips it before rendering** — the component never receives it and never has to declare it. This is typed the way React types `key`: the package augments `React.Attributes` with an optional `id`, so `<Login id="login" />` typechecks even when `Login` declares no props (the same mechanism Emotion uses for its `css` prop). A component that wants its own `id` prop for its own purposes should be declared via `<Wizard.Step id="...">` instead, keeping its props untouched.

**Full config — a `<Wizard.Step>` wrapper**, for when a step needs meta/lifecycle inline. `Wizard.Step` is a config-only marker (renders nothing itself; `Wizard` detects `element.type === Wizard.Step` and unwraps):

```tsx
<Wizard>
  <Wizard.Step id="login" meta={{ title: "Sign in" }} onEnter={logEnter}>
    <Login />
  </Wizard.Step>
  <Verify id="verify" />
</Wizard>
```

`Wizard.Step` props are `{ id, meta?, onEnter?, onLeave?, effect?, after?, children }` — identical vocabulary to the object form and to core's linear step object.

### 3.5 Step identity rules (mandatory + unique)

- The derived step list is recomputed each render from children (flattening fragments/arrays, skipping `null`/`false`) or from object keys.
- A step with no resolvable id → dev-mode thrown error naming the child's position and component display name.
- Duplicate ids → dev-mode thrown error.
- There is **no index fallback**. Ids are always stable, so persistence keys, devtools labels, and linear→graph migration are always safe.

### 3.6 Dynamic / conditional children

Conditional steps are supported via **machine transplant** — core definitions stay immutable:

```tsx
<Wizard context={{ needs2fa: false }}>
  <Login id="login" />
  {needs2fa && <Setup2fa id="setup2fa" />}
  <Done id="done" />
</Wizard>
```

On each render, `Wizard` compares the derived id-list signature with the mounted machine's. If it changed:

1. Build a new `LinearJourneyDefinition` from the new list.
2. Create a fresh core machine hydrated from the previous snapshot (via the new `initialSnapshot` core option, §8).
3. Transplant rules: `context` carried over verbatim; `history.timeline` and `visited` filtered to surviving ids; `history.index` clamped; if the active id survived it stays active, otherwise fall back to the nearest surviving index with a dev warning.

Mandatory ids make the transplant exact — there is no positional ambiguity on reorder.

### 3.7 Shared typed state — a core concern, not React state

The wizard's cross-component state is the core machine's `context`. It is **never** React `useState` or a React-context value:

- Typed (`TContext`), JSON-serializable, part of the snapshot base (§6), persisted by `persist`, visible in devtools, and carried intact through linear→graph migration and dynamic-step transplants.
- Single writer: `updateContext(ctx => next)` — a functional updater queued through the machine's serialized action queue, so concurrent steps cannot lose updates.
- Granular reads: `useWizard().context` for the whole object, or `useWizardSelector(s => s.context.email)` to re-render only when a slice changes.

Two typing paths, in order of strength:

```tsx
// (1) createWizard — TContext fully inferred, no generics at call sites
const wizard = createWizard({
  context: { email: "", attempts: 0 },
  steps: { login: Login, verify: Verify }
});
const { context, updateContext } = wizard.useWizard(); // context: { email: string; attempts: number }

// (2) zero-factory — generic assertion at the call site (same trade react-use-wizard makes)
type Ctx = { email: string; attempts: number };
<Wizard context={{ email: "", attempts: 0 } satisfies Ctx}>…</Wizard>;
const { context } = useWizard<Ctx>();
```

A TanStack-style `Register` module augmentation (making bare `useWizard()` globally typed) is an open question (§10) — it fights multi-wizard apps, so it is deferred.

### 3.8 `useWizard()` and companions

```ts
function useWizard<TContext extends JourneyJsonObject = JourneyJsonObject>(): UseWizardResult<
  TContext,
  string
>;

type UseWizardResult<TContext extends JourneyJsonObject, TStepId extends string> = {
  // position
  activeStepId: TStepId;
  activeStepIndex: number;
  stepCount: number;
  stepIds: readonly TStepId[];
  isFirstStep: boolean;
  isLastStep: boolean;

  // visit tracking
  visited: Record<TStepId, boolean>;
  /** True while the active step is on its first visit (history.timeline contains it exactly once). */
  isFirstTimeVisit: boolean;

  // status
  status: JourneyStatus;
  isLoading: boolean; // pending useWizardStep handler or core async phase on the active step
  isPaused: boolean;
  error: unknown; // active step's async error, else null

  // navigation — existing machine names, verbatim
  goToNextStep(): Promise<JourneySendResult<TContext, TStepId>>;
  goToPreviousStep(steps?: number): Promise<JourneySendResult<TContext, TStepId>>;
  goToStepById(stepId: TStepId): Promise<JourneySendResult<TContext, TStepId>>;
  goToStepByIndex(index: number): Promise<JourneySendResult<TContext, TStepId>>;
  goToLastVisitedStep(): Promise<JourneySendResult<TContext, TStepId>>;
  completeJourney(): Promise<JourneySendResult<TContext, TStepId>>;
  resetJourney(): Promise<LinearJourneySnapshot<TContext, TStepId>>;
  pauseJourney(): void;
  resumeJourney(): void;
  clearStepError(stepId?: TStepId): Promise<LinearJourneySnapshot<TContext, TStepId>>;

  // shared state
  context: TContext;
  updateContext(
    updater: (context: TContext) => TContext
  ): Promise<LinearJourneySnapshot<TContext, TStepId>>;

  // metadata
  activeStepMeta: JourneyJsonValue | undefined;
  getStepMeta(stepId: TStepId): JourneyJsonValue | undefined;

  // escape hatches
  snapshot: LinearJourneySnapshot<TContext, TStepId>;
  machine: LinearJourneyMachine<TContext, TStepId>;
};
```

**`useWizardSelector`** — render optimization:

```ts
function useWizardSelector<T>(
  selector: (snapshot: LinearJourneySnapshot<JourneyJsonObject, string>) => T,
  equalityFn?: JourneyEqualityFn<T>
): T;
```

**`useWizardStep`** — the react-use-wizard `handleStep` equivalent. Called inside a step component; registers a forward-navigation interceptor for the active step (React-layer ref registry — no machine state). `goToNextStep` awaits it first; a throw/reject cancels navigation and sets `error`; `isLoading` is true while pending. Forward-only.

```ts
function useWizardStep<TContext extends JourneyJsonObject = JourneyJsonObject>(
  handler?: (args: {
    context: TContext;
    updateContext: (updater: (context: TContext) => TContext) => Promise<unknown>;
  }) => void | Promise<void>
): void;
```

```tsx
const Password = () => {
  const { context } = useWizard<Ctx>();
  useWizardStep(async ({ context, updateContext }) => {
    const ok = await validatePassword(context.password); // reject → navigation cancelled
    if (!ok) throw new Error("Invalid password");
    await updateContext((ctx) => ({ ...ctx, validatedAt: Date.now() }));
  });
  return <PasswordForm />;
};
```

This lives purely in the React layer, layered on top of (not instead of) core `effect` / `onLeave`.

### 3.9 `createWizard()` — the typed escape hatch

```ts
function createWizard<
  TContext extends JourneyJsonObject,
  const TSteps extends WizardStepsProp<TContext>
>(config: {
  context: TContext;
  steps: TSteps; // object form only — keys give the typed id union
  startStepId?: keyof TSteps & string;
  persist?: WizardPersistProp;
  plugins?: readonly JourneyMachinePlugin[];
  handlers?: Record<string, unknown>;
  requireExplicitCompletion?: boolean;
}): WizardBundle<TContext, Extract<keyof TSteps, string>>;

type WizardBundle<TContext extends JourneyJsonObject, TStepId extends string> = {
  /** Pre-bound Wizard: no steps/context props needed; accepts render-time overrides. */
  Wizard: React.ComponentType<
    Partial<
      Pick<
        WizardProps<TContext>,
        | "context"
        | "startStepId"
        | "header"
        | "footer"
        | "wrapper"
        | "fallback"
        | "onStepChange"
        | "onStepEnter"
        | "onStepLeave"
        | "onComplete"
        | "onError"
        | "machineRef"
      >
    >
  >;
  useWizard: () => UseWizardResult<TContext, TStepId>;
  useWizardSelector: <T>(
    sel: (s: LinearJourneySnapshot<TContext, TStepId>) => T,
    eq?: JourneyEqualityFn<T>
  ) => T;
  useWizardStep: (handler?: WizardStepHandler<TContext>) => void;
  /** Migration: emit the equivalent core graph JourneyDefinition (§7). */
  toGraphDefinition: () => JourneyDefinition<TContext, TStepId>;
};
```

Crucially, `createWizard` does **not** create a machine (unlike today's factories). It returns typed re-exports bound to the same internal React context; the machine is still created per `<Wizard>` mount. Zero-config and bundle wizards share one runtime path; `machineRef` / `useWizard().machine` give the addressable machine for devtools.

### 3.10 Mapping onto core, StrictMode

`<Wizard>` is a thin shell over existing machinery:

1. Derive the step list → build a `LinearJourneyDefinition` (`context`, `steps`, `initial` from `startStepId`/`startIndex`).
2. Create the machine with core `createLinearJourney(definition, { plugins, handlers, requireExplicitCompletion })`; `persist` expands into the persistence plugin prepended to `plugins`.
3. Ownership: the existing `use-journey.ts` pattern verbatim — lazy ref init (StrictMode double render creates exactly one machine) and layout-effect cleanup that schedules `dispose()` via `setTimeout(0)`, cancelled by a StrictMode re-mount.
4. Subscribe via `useSyncExternalStore` on `machine.subscribe`; `startJourney()` fires in a layout effect when `status === "idled"` (same controller logic as today's `Provider.tsx`).
5. Render: match `snapshot.currentStepId` to the derived step's element/component, keyed by step id, cloned into `wrapper` when given; `header`/`footer` render inside the wizard context.
6. `onComplete` via `subscribeSelector(s => s.status)`; `onStepChange` via `subscribeSelector(s => s.currentStepId)`; `onStepEnter`/`onStepLeave` via the observation event stream.

### 3.11 SSR

- No module-scope machine → no cross-request state leaks. The pre-start snapshot already has `currentStepId = initial` with `status: "idled"`, so the server renders the first step's HTML synchronously; `startJourney` runs client-side in the layout effect.
- With `persist`, rehydration happens client-side at start, which risks a hydration mismatch. **Default: render `fallback` until `status !== "idled"`** (deterministic on both sides). Open question §10.3.

### 3.12 Amendment: verbatim thin wrapper — core owns all linear semantics (accepted 2026-07-18)

An audit of the shipped wrapper (3.14 kB brotli against the 601 B headless
tier) found framework-agnostic logic still living in React, in tension with
§6.1's "all linear semantics live in core." This amendment finishes the move
and tightens the wrapper contract to **verbatim**: the React layer performs no
reshaping and no name translation — anything a Vue/Svelte wrapper would have to
reimplement identically belongs in core.

**Four core absorptions (additive):**

1. **`startAt` creation option** (`JourneyRuntimeOptions.startAt?: TStepId`,
   linear and graph). The initial entry resolves `startAt ?? initial` inside
   the runtime, replacing the wrapper's deferred `goToStepById` workaround for
   the "transitioning" rejection window. Semantics: the journey starts
   _directly_ at the target — only its `onEnter` fires, earlier steps are
   neither entered nor visited, the timeline is `[startAt]`, and `restart()`
   returns to `startAt`. An unknown id throws at creation (programmer error).
2. **`persist` creation option** (`JourneyRuntimeOptions.persist?: { key,
storage? }`). Expands to the persistence plugin prepended to `plugins`
   (formalizing §3.10 item 2 in core). `storage` defaults to
   `globalThis.localStorage`; creation throws when neither is available.
3. **`direction` on the `stepEnter` payload** (`"forward" | "backward" |
"jump"`). Intent-based, not index math: only `goToNextStep` /
   `goToPreviousStep` report `"forward"`/`"backward"`; the initial entry,
   `goToStepById`, `goToStepByIndex`, `goToLastVisitedStep`, and graph `send`
   report `"jump"`. Indices stay off the payload (linear-only concepts, already
   on the snapshot). Behavior change: an adjacent `goToStepById` was previously
   reported "forward" by the React wiring; it is now a `"jump"`.
4. **`registerNextStepInterceptor` lands in core** as promised by §6.1:
   `machine.navigate.registerNextStepInterceptor(stepId, work): () => void`,
   last-registration-wins, consulted by `goToNextStep` when no explicit work is
   passed. The React-side interceptor store is deleted; `useLinearJourneyStep`
   becomes a registration shell. Core linear `navigate` also gains
   `goToStepByIndex` (already promised by §6.1).

**Verbatim wrapper contract (breaking, pre-1.0):**

- `useLinearJourney()` returns `{ machine, snapshot }` — both core-shaped. The
  flat ~25-field result (`activeStepId`, `stepCount`, `goToNextStep`, …) is
  deleted, not moved: consumers read `snapshot.currentStep.isFirstStep` and
  call `machine.navigate.goToNextStep()`.
- No name translation: the step `meta` prop becomes `metadata` (core's name),
  `startStepId` becomes `startAt` (`startIndex` remains as JSX-order sugar
  resolved wrapper-side), and callback props are named after core events —
  `onStepEnter` (verbatim `stepEnter` payload, now carrying `direction`),
  `onStepLeave`, `onError` (verbatim payloads), `onComplete` (`statusChange`
  gated on `"completed"`), `onStart` (once per mount, receives the start
  snapshot). The React-invented `onStepChange` name and its
  `LinearJourneyStepChange` shape are deleted.
- What remains React-owned: JSX children → step-list derivation, contexts,
  StrictMode-safe mount/dispose lifecycle, `useSyncExternalStore` subscription,
  and verbatim event→prop forwarding.
- The global `React.Attributes` `id` augmentation (§3.5's inline-id typing
  mechanism) is **removed** — it silently disabled excess-prop checking for
  `id` on every component in the consumer's app. `<LinearJourney.Step id>` is
  the canonical spelling; the inline `id` prop still works at runtime and
  type-checks for components that declare their own `id` prop.
- The React `LinearJourneySnapshot` narrows `currentStep` to non-null (a
  rendered journey never observes idle) — a type-level invariant, not
  reshaping.
- **Creation options are one verbatim prop** (accepted 2026-07-19): `startAt`,
  `persist`, and `plugins` are no longer individual props — `<LinearJourney
options>` takes Core's `JourneyRuntimeOptions` unchanged, frozen at mount,
  with `autoStart` defaulting to `true`. **The start moved out of render into
  a layout effect** (subscribers attach first, so the initial `stepEnter`
  reaches the callback props and `onStart` fires from it): render is pure — no
  entry hooks, no persistence writes. While idle, only `fallback` renders
  (also the SSR payload, per §3.11's original default), and the client start
  re-renders synchronously before paint. `startIndex` stays as JSX-order
  sugar.

**Deferred (follow-up, out of scope here):** statically stripping dev-only
error/warning strings from production bundles via build-time `define`
(`__DEV__` / `NODE_ENV`) — ~18 % of the wrapper's minified bytes are DX
message strings.

## 4. Tier 2 — Graph: `@rxova/journey-react/graph`

Graph flows keep the definition/views separation — that ceremony is the tier's point. One decisive change from today: **`createGraphJourney` no longer instantiates a machine at module scope.** It captures the definition and returns context-bound components/hooks; a machine is created per `<Provider>` mount with the same ownership pattern. Multiple `<Provider>`s = independent instances. The runtime-object indirection (`machine`/`dispose` on a module singleton) is gone.

```ts
function createGraphJourney<const TDefinition, TPlugins extends readonly JourneyMachinePlugin[] = []>(
  definition: TDefinition & AssertNoSelfTransitions<NoInfer<TDefinition>>,   // pure core JourneyDefinition
  options?: JourneyOptionsInput<TPlugins, JourneyHandlersOfDefinition<TDefinition>>
): GraphJourneyBundle<TDefinition, TPlugins>;

type GraphJourneyBundle<…> = {   // TContext/TStepId/TEvents/TStepMeta inferred via type-helpers as today
  Provider: React.ComponentType<{
    views: Record<TStepId, React.ComponentType>;
    context?: Partial<TContext>;        // per-mount override, shallow-merged over definition context
    autoStart?: boolean;                // default true
    onError?: (error: unknown, ctx: JourneyProviderErrorContext) => void;
    machineRef?: React.Ref<JourneyMachineWithPlugins<…>>;
    children: React.ReactNode;
  }>;
  StepRenderer: React.ComponentType<{ fallback?: React.ReactNode }>;
  useSnapshot(): GraphJourneySnapshot<TContext, TStepId>;
  useComputed(): JourneyGraphComputed<TStepId>;
  useSelector<T>(sel: JourneySelector<TContext, TStepId, T>, eq?: JourneyEqualityFn<T>): T;
  useApi(): JourneyApi<TContext, TStepId, TEvents, TStepMeta>;          // includes pauseJourney/resumeJourney
  useStepApi<K extends TStepId>(stepId: K): StepScopedJourneyApi<…>;    // kept — best-typed feature today
  useStepAsyncState(stepId: TStepId): JourneyStepAsyncState;
  useEvent(listener: (e: JourneyObservationEvent<TStepId, TEvents>) => void): void;
  useStepLifecycle(stepId: TStepId, cbs: { onEnter?; onLeave? }): void;
  useMachine(): JourneyMachineWithPlugins<…>;
};
```

```tsx
const checkout = createGraphJourney({
  initial: "cart",
  context: { items: [] as CartItem[] },
  steps: { cart: {}, shipping: {}, payment: { effect: { run: "authorize" } }, confirm: {} },
  transitions: {
    cart:     { goToNextStep: "shipping" },
    shipping: { goToNextStep: [{ target: "payment", guard: ({ context }) => context.items.length > 0 }] },
    payment:  { paymentFailed: "cart", goToNextStep: "confirm" },
  },
});

export const CheckoutFlow = () => (
  <checkout.Provider views={{ cart: Cart, shipping: Shipping, payment: Payment, confirm: Confirm }}>
    <ProgressHeader />
    <checkout.StepRenderer fallback={<Spinner />} />
  </checkout.Provider>
);

const Payment = () => {
  const { send } = checkout.useStepApi("payment");   // only events "payment" handles are typed here
  const async = checkout.useStepAsyncState("payment");
  …
};
```

The definition stays a pure, serializable core `JourneyDefinition` (devtools/codegen-friendly). Hook names drop the `Journey` prefix because they are always namespaced (`checkout.useApi()` reads better than `checkout.useJourneyApi()`); machine method names inside are unchanged.

## 5. Tier 3 — Headless: `@rxova/journey-react/headless`

Hooks-only. No provider, no bound object, no react-side factory — you create the machine with core's `createHeadlessJourney` (or any core factory) and pass it as the first argument. All types are inferred from the machine, which can live in a module, a store, a prop, or be component-owned:

```ts
/** Component-owned machine lifecycle: today's use-journey.ts, renamed and tier-neutral. */
function useOwnedJourney<TMachine extends { dispose(): void }>(factory: () => TMachine): TMachine;

function useJourneySnapshot<M extends AnyJourneyMachine>(machine: M): SnapshotOf<M>;
function useJourneySelector<M extends AnyJourneyMachine, T>(
  machine: M,
  selector: (snapshot: SnapshotOf<M>) => T,
  equalityFn?: JourneyEqualityFn<T>
): T;
function useJourneyComputed<M extends AnyJourneyMachine>(machine: M): ComputedOf<M>;
function useStepAsyncState<M extends AnyJourneyMachine>(
  machine: M,
  stepId: StepIdOf<M>
): JourneyStepAsyncState;
function useJourneyEvent<M extends AnyJourneyMachine>(
  machine: M,
  listener: (event: ObservationEventOf<M>) => void
): void;
function useJourneyStepLifecycle<M extends AnyJourneyMachine>(
  machine: M,
  stepId: StepIdOf<M>,
  cbs: { onEnter?; onLeave? }
): void;
```

```tsx
import { createHeadlessJourney } from "@rxova/journey-core";
import { useOwnedJourney, useJourneySelector } from "@rxova/journey-react/headless";

function RiskBanner() {
  const machine = useOwnedJourney(() =>
    createHeadlessJourney({
      initial: "watching",
      context: { score: 0 },
      steps: { watching: {}, flagged: {} }
    })
  );
  const phase = useJourneySelector(machine, (s) => s.currentStepId);
  return phase === "flagged" ? (
    <Banner onAck={() => void machine.goToStepById("watching")} />
  ) : null;
}
```

These machine-argument hooks are also the internal primitive layer the wizard and graph tiers are built on — a single `useSyncExternalStore` implementation written once.

## 6. The snapshot family: one base, two types

Linear and graph snapshots are **separate types in a discriminated union**, sharing a common base. They are not required to stay identical, but they must stay as close as possible — especially `history`, `visited`, `status`, `context`, and step-metadata access.

```ts
/** Common base — the fields every tier's snapshot must carry, with identical semantics. */
type JourneySnapshotBase<TContext extends JourneyJsonObject, TStepId extends string> = {
  currentStepId: TStepId;
  history: JourneyHistory<TStepId>; // { timeline, index }
  context: TContext;
  visited: Record<TStepId, boolean>;
  status: JourneyStatus;
  async: JourneyAsyncState<TStepId>; // transient; dropped on persist as today
};

type LinearJourneySnapshot<
  TContext extends JourneyJsonObject,
  TStepId extends string
> = JourneySnapshotBase<TContext, TStepId> & {
  type: "linear";
  /** Authoritative step order — makes the persisted linear snapshot self-describing. */
  stepOrder: readonly TStepId[];
};

type GraphJourneySnapshot<
  TContext extends JourneyJsonObject,
  TStepId extends string
> = JourneySnapshotBase<TContext, TStepId> & {
  type: "graph";
};

type JourneySnapshot<TContext extends JourneyJsonObject, TStepId extends string> =
  | LinearJourneySnapshot<TContext, TStepId>
  | GraphJourneySnapshot<TContext, TStepId>;
```

Rules:

- **Headless machines emit `type: "graph"`** — headless is the graph runtime without a rendering opinion, not a third snapshot format.
- **The base may only grow by agreement of both tiers.** Divergence happens in the variant-specific fields (`stepOrder` today; whatever each runtime needs tomorrow), never by redefining base-field semantics. This is what keeps linear→graph migration and cross-tier tooling cheap.
- **Two runtimes are acceptable.** Initially both tiers run on the existing core engine (linear compiled to a forward chain, as today). The discriminated snapshot is what makes a future dedicated linear runtime (index-based, no graph resolution) a non-breaking implementation swap — the wizard's observable contract is `LinearJourneySnapshot`, not the engine behind it.
- The persistence envelope becomes `{ version, snapshot }` where the persisted snapshot **includes `type`** (still minus `async`). Hydration validates that the stored `type` matches the machine's mode and rejects/coerces mismatches through the existing `coercePersistedSnapshot` path.
- `isPaused` remains outside the snapshot in both variants (transient runtime flag, not persisted).
- The React tiers add **zero durable state of their own** — the only React-side state is the transient `useWizardStep` handler registry (refs). Persistence, autosave, analytics, replay, and diagnostics operate on the base fields and work across tiers; anything type-specific must switch on `type`.
- **Devtools:** the devtools bridge and UI discriminate on `snapshot.type` — a stepper/timeline presentation for `"linear"`, the graph/transition presentation for `"graph"` (and headless). The devtools registry payload carries the discriminator through unchanged.

### 6.1 Amendment: the linear family has its own runtime (implemented)

`createLinearJourney` no longer compiles to the graph engine. It is a dedicated
linear runtime in core: navigation is index-based over `stepOrder` (arbitrary
`goToStepById`/`goToStepByIndex` jumps are legal), the definition accepts
`initial`/`startIndex`, per-step **`visits` entry counts are part of the linear
snapshot** (persisted; `visited` stays as the derived base field with the
invariant `visited[id] === visits[id] > 0`; every entry counts, including
backward navigation), linear `getComputed()` gains `isFirstTimeVisit`, forward
navigation is interceptable per step via `registerNextStepInterceptor` (the
mechanism behind `useWizardStep`, reporting through the shared async-state
phases), and `deriveLinearTransplantSnapshot` is the core seam for dynamic step
changes. The React wizard is now a pure rendering wrapper: it derives steps
from JSX, owns the machine lifecycle, and renders — all linear semantics live
in core, shared with future Vue/Angular wrappers. Plugins, persistence,
devtools, and the observation-event stream keep the shared machine contract
(the graph-shaped definition remains available to structural tooling as data).

## 7. Linear→graph migration

**Helpers (core, framework-agnostic):**

- `toGraphDefinition(linearDefinition)` — a new core export that reuses the existing linear→resolved-transition compilation and serializes it back into authorable form: a `steps` record (carrying meta/lifecycle/effect/after) plus a forward `transitions` chain (`a: { goToNextStep: "b" }, …`), with the last step completing per `requireExplicitCompletion` semantics. Backward navigation needs no transitions (history-based in graph mode). Exposed on the wizard bundle as `bundle.toGraphDefinition()`.
- `toGraphSnapshot(linearSnapshot)` — converts a `LinearJourneySnapshot` (live or persisted) into a `GraphJourneySnapshot`: flips `type`, drops `stepOrder`, keeps the base fields verbatim. Because step ids are mandatory and stable, `currentStepId`, `history.timeline`, and `visited` carry over unchanged — this is what keeps stored user progress valid across a linear→graph migration (feed the result through the graph machine's `initialSnapshot` option or a persistence `migrate` step).

**Codemod (sketch; built in a later phase):** a jscodeshift transform that

1. finds `createWizard(config)` / `<Wizard steps={…}>` call sites,
2. emits `createGraphJourney({ initial, context, steps, transitions: chain })` plus a `views` map from the components,
3. rewrites `useWizard()` destructurings to `bundle.useApi()` + `bundle.useComputed()` equivalents — near rename-free because method names are identical across tiers (constraint #8).

Children-form wizards are migrated the same way; ids are already explicit (constraint #6), so the emitted graph definition is exact.

## 8. Core changes (four) and react deletions

### Core — four additions

1. **The snapshot `type` discriminator** (§6): `JourneySnapshot` becomes the `LinearJourneySnapshot | GraphJourneySnapshot` union; linear machines emit `type: "linear"` + `stepOrder`, graph and headless machines emit `type: "graph"`. The persistence controller persists/validates the discriminator; the devtools registry passes it through.
2. **`toGraphDefinition(linearDefinition)`** and **`toGraphSnapshot(linearSnapshot)`** — new exports (`packages/core/src/to-graph-definition.ts`).
3. **`initialSnapshot?`** on `JourneyMachineOptions` (accepting the persisted-state form of the matching snapshot type), validated against the resolved definition — the first-class seam for the wizard's dynamic-step transplant (§3.6), also useful for tests and SSR resume. The persistence plugin's `hydrateSnapshot` hook already proves this seam; the option makes it public.
4. **`pauseJourney()` / `resumeJourney()` / `isPaused`** on the machine — a transient runtime flag (not in the snapshot, not persisted). While paused, navigation/`send` resolve as no-ops with a dedicated no-op `JourneySendResult` reason so callers can tell; `updateContext` still works. Surfaced in `JourneyApi` (graph tier), directly on the machine (headless), and in `useWizard` (linear). Devtools can display it.

Machine API naming, event unions, and plugin hooks are untouched. The devtools bridge gains `type`-aware presentation (§6) but its transport contract only grows by the discriminator.

### `packages/react` — deleted

`CreateJourney.tsx`, `CreateJourneyFactory.tsx`, `CreateLinearJourney.tsx`, `CreateGraphJourney.tsx` (old semantics), `CreateHeadlessJourney.tsx`, `Provider.tsx` (views-context runtime), and the runtime-object types in `types.ts` (`JourneyRuntime`, `LinearJourneyRuntime`, `JourneyBuilderRuntime*`, `JourneyRuntimeFactory*`, `JourneyViews`).

### Kept / moved

- `use-journey.ts` → headless `useOwnedJourney` (mechanism unchanged).
- `Hooks.tsx` subscription plumbing → rewritten once as machine-argument hooks (headless tier), reused by wizard and graph.
- `type-helpers.ts` event-typing machinery → reused by the graph bundle (`useStepApi` typing).
- `JourneyApi` / `StepScopedJourneyApi` types → kept (gain `pauseJourney`/`resumeJourney`).

## 9. Package / exports layout

```
packages/react/src/
  wizard/     Wizard.tsx, wizard-context.ts, derive-steps.ts, use-wizard.ts,
              use-wizard-step.ts, create-wizard.ts, persist.ts, types.ts
  graph/      create-graph-journey.tsx, types.ts
  headless/   hooks.ts, use-owned-journey.ts
```

`package.json` exports:

- `@rxova/journey-react` → wizard tier (the marketing-page API)
- `@rxova/journey-react/graph`
- `@rxova/journey-react/headless`

This mirrors core's subpath-export precedent for plugins and keeps the wizard's docs/autocomplete surface uncluttered. Open question §10.1.

## 10. Open questions

1. **Subpath exports** (`/graph`, `/headless`) vs everything from the root. _Recommendation: subpaths._
2. **Core `initialSnapshot` option** vs keeping the transplant behind a private hydrate plugin. _Recommendation: the public option — it is generally useful (tests, SSR resume)._
3. **SSR + `persist` default:** render `fallback` until started (deterministic, no hydration mismatch) vs render the initial step and accept a post-hydration swap. _Recommendation: `fallback`._
4. **`useWizardStep` forward-only** interception (react-use-wizard parity) vs also intercepting jumps/backward. _Recommendation: forward-only._
5. **Graph tier component names** `Provider`/`StepRenderer` kept vs an `Outlet`-style rename. _Recommendation: keep._
6. **`Register` module augmentation** so bare `useWizard()` is globally typed without a generic. _Recommendation: defer — it fights multi-wizard apps._

## 11. Implementation phasing

- **Phase 1 — core seams:** the snapshot `type` discriminator + `stepOrder` on linear snapshots (persistence coercion updated), `toGraphDefinition` + `toGraphSnapshot`, `initialSnapshot` option, `pauseJourney`/`resumeJourney`/`isPaused` + no-op send reason, tests.
- **Phase 2 — headless primitives:** `packages/react/src/headless/` (machine-argument hooks + `useOwnedJourney` moved from `use-journey.ts`), tests. Foundation for the other tiers.
- **Phase 3 — wizard tier:** `packages/react/src/wizard/` (children form → `Wizard.Step` → object form → `useWizardStep` → `createWizard` → `persist` sugar → dynamic-step transplant), StrictMode/SSR tests, `examples/react-showcase-linear` rewrite.
- **Phase 4 — graph tier:** `packages/react/src/graph/`, port `type-helpers.ts` typing, `examples/react-showcase-graph` rewrite.
- **Phase 5 — deletion, devtools & docs:** remove old files, rewrite `packages/react/src/index.ts` + `package.json` exports, update remaining `examples/react-*`, rewrite `apps/docs/docs/react/*` (quickstart becomes the wizard), devtools-bridge update: discriminate on `snapshot.type` (stepper presentation for `"linear"`, graph presentation for `"graph"`/headless) + smoke test.
- **Phase 6 (optional/later):** the jscodeshift codemod package.

## 12. Appendix — before / after

### Before (current API, `examples/react-showcase-linear`)

```tsx
// journey.ts
export const journey = createLinearJourney<LoginContext, StepId, StepMeta>({
  context: {
    username: "",
    password: "",
    verificationCode: "",
    qrCode: null,
    error: null,
    attempts: 0
  },
  steps: [
    { id: "login", meta: { label: "Login" } },
    { id: "setup2fa", meta: { label: "Setup 2FA" } },
    { id: "verifyCode", meta: { label: "Verify Code" } },
    { id: "loggedIn", meta: { label: "Logged In" } }
  ]
});

// App.tsx
const views: JourneyViews<StepId> = {
  login: Login,
  setup2fa: Setup2fa,
  verifyCode: VerifyCode,
  loggedIn: LoggedIn
};

export default function App() {
  return (
    <journey.JourneyProvider views={views}>
      <Shell>
        <journey.StepRenderer fallback={<p>Unknown step</p>} />
      </Shell>
    </journey.JourneyProvider>
  );
}

// Login.tsx
const snapshot = journey.useJourneySnapshot();
const api = journey.useJourneyApi();
```

### After (this RFC)

```tsx
// App.tsx — that's all of it
export default function App() {
  return (
    <Wizard context={initialContext} wrapper={<Shell />}>
      <Login id="login" />
      <Setup2fa id="setup2fa" />
      <VerifyCode id="verifyCode" />
      <LoggedIn id="loggedIn" />
    </Wizard>
  );
}

// Login.tsx
const { context, updateContext, goToNextStep } = useWizard<LoginContext>();
```

```ts


const machine = createLinearMachine({
  steps: [{
    id:'',
    metadata: { } // whatever, lets say that here we have free form but that all the steps need to be with it
    onEnter?: ()=>{} // should be able to inspect the snapshot
    onLeave?: ()=>{} // should be able to inspect the snapshot
  }], // could just be an array of ids too.
  context: {} // starting sharing data layer. might even be a boolean.
}, options: {
  autoStart: false // default is true ,
  defaultTimeoutMs?: number; // for Async
  plugins?: TPlugins;
  initialSnapshot?: JourneySnapshotStateBase<JourneyJsonObject, string>;
  onListenerError?: (error: unknown, context: "snapshot" | "event") => void;
  onLifecycleError?: (error: unknown, context: JourneyLifecycleErrorContext<string>) => void;
})

const machineResult = {
  controls: {
    pause(),
    terminate(),
    resume(),
    restart(),
    start(),
    complete(),
  },
  dispose,
  navigate: {
    goToStepById(),
    goToPreviousStep(n: amountOfSteps),
    goToNextStep(),
    goToLastVisitedStep() // rehydrates histroy, does nothing is currrentStep is the last step
  },
  history: {
    visited:{
      TStepId: Boolean
    },
    timeline: TStepId[],
    currentIndex: number, // pointer in the timeline, not currentIndex of the step.
  },
  computed: => {
    type: 'linear' | 'graph' | 'headless',
    state: 'idle' | 'running' | 'paused' | 'completed' | 'terminated',
    async: {
        transitioning: boolean,          // true while onLeave/onEnter promises are pending
    }
    currentStep: {
      id: string,
      index: number,
      isLastStep: boolean,
      isFirstStep: boolean,
      isFirstTimeVisit: boolean, // if it is true in history.visited
      metadata: // the metadata on the declaration
      async: {isLoading, isError, error, ...etc} // to be designed. Related to onEnter and onLeave.
    },
    steps: {
      totalSteps: number,
      stepOrder: readonly TStepId[],
      visitedStepCount,
    },
    machine:{
      isLoading, // TBD
      isIdle: snapshot.status === "idled",
      isRunning: snapshot.status === "running",
      isComplete: snapshot.status === "completed",
      isTerminated: snapshot.status === "terminated",
    }
  },
  subscriptions: {
    subscribeSelector(),
    subscribeEvent(), // this one can do when a step enters, a step leaves.
     on(event, listener): Unsubscribe, // events: 'stepEnter' | 'stepLeave' | 'statusChange' | 'contextChange' | 'navigationBlocked'

  },
  context: {
    update();
    value: TData, // open to suggestions.
  }
}


type NavigationResult =
  | { ok: true; from: TStepId | null; to: TStepId }
  | { ok: false; reason: 'blocked'         // an onLeave guard returned false
              | 'transitioning'            // nav requested while hooks pending → rejected, not queued
              | 'not-running'              // paused / idle / completed / terminated
              | 'invalid-target' }         // unknown id, or graph edge doesn't exist


// snapshot-level — "is any hook chain in flight"
transition: {
  pending: boolean,
  phase: 'leaving' | 'entering' | null,
  from: TStepId | null,
  to: TStepId | null,
}


// snapshot.currentStep.async — the state of THIS step's onEnter
{ isLoading: boolean, isSuccess: boolean, isError: boolean, error: unknown | null }


export type JourneyBaseEvent = {
  type: string;
  payload?: unknown;
};
```

notes: autostart triggers the onEnter on the first step, doesn't matter if it is async. User problem. if they don't want an async on the first step, they can just not use it, and trigger stuff inside the component.
