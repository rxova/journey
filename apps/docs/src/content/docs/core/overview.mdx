# Overview

Journey is a flow runtime for products that need more than "next" and "back" — and flows do not come in one shape.

- **Linear** — a sign-up wizard, a checkout, an onboarding sequence.
- **Graph** — branches, conditional routing, retries, loops, more than one valid way to finish.
- **Imperative** — the next step is decided by the caller at runtime (a server response, a feature flag, an A/B bucket), with no fixed map at all.

Journey's goal is to be the one runtime behind all three — so you model the flow you actually have instead of bending it to fit a tool, keep a single mental model as it grows, and drop it into the rest of your app without ceremony.

:::tip The core promise
Define your flow once. Drive it predictably. Inspect it completely.
:::

Whatever the shape, Journey always guarantees the same foundation underneath:

- **A snapshot you can trust.** One serializable place that holds current step, history, context, status, visited state, and async state — so you can persist it, resume it, send it to devtools, or assert on it in a test. When that state is spread across component hooks, there isn't a centralized one to point at and call "the state of the flow."
- **Transition rules in one place.** Movement is decided by data, not by whichever button handler happens to fire. When the rule lives in the transition, the flow stays reviewable and the path stays explicit. When it lives in event handlers, reconstructing "how do we get from A to B" means reading through multiple components — which tend to grow over time.
- **Async as part of the model.** Flows usually need to gate on things like network checks, validation, and eligibility calls. Those are easier to handle with explicit phases, timeouts, and per-step error state, rather than a `loading` boolean added at render time.

Most tools cover part of this, but tend to leave a gap or two:

- **Ad-hoc component state** (`useState`/`useReducer`) gets you started quickly, but leaves all three for you to wire up by hand.
- **A router** gives you navigation, but ties your flow to URLs and leaves the snapshot and async story to you.
- **A full statechart engine** gives you transitions and async, but makes you model everything as a graph — overkill for a wizard, awkward for caller-driven navigation, and a steep climb when all you needed was a reliable runtime.

Journey gives you all three — snapshot, transition-first rules, first-class async — **and lets the flow keep whatever shape it actually has.** Define it once, drive it predictably, inspect it completely.

## Three Modes

A graph engine forces every flow into a graph. A wizard library can't branch. Journey instead exposes **three factories over one runtime**, so the API matches the flow's shape instead of fighting it. All three produce the same snapshot, the same async semantics, and the same observability — they differ only in **how the next step is decided**:

| Mode         | Factory                 | Who decides the next step              | Solves                                                              |
| ------------ | ----------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| **Linear**   | `createLinearJourney`   | An ordered list of steps               | Fixed, top-to-bottom flows: wizards, checkouts, onboarding          |
| **Graph**    | `createGraphJourney`    | Transitions + guards on the definition | Branching, conditional routing, retries, loops, custom events       |
| **Headless** | `createHeadlessJourney` | The caller, at runtime, per move       | Flows whose path is computed elsewhere (server, flags, experiments) |

Each mode just constrains the same machine differently. Linear derives transitions from step order so `goToNextStep` "just works"; Graph asks you to declare transitions so the path is explicit and inspectable; Headless declares no transitions at all and hands navigation to the caller.

### Navigation API per mode

Every mode exposes the full machine API — reading the snapshot, subscribing, updating context, completing/terminating, async handling. What changes is **which navigation calls are meaningful**:

| Method                       | Linear            | Graph                 | Headless             | What it does                                              |
| ---------------------------- | ----------------- | --------------------- | -------------------- | --------------------------------------------------------- |
| `goToNextStep()`             | ✅ primary driver | ✅ follows transition | ⛔ no-op¹            | Advance via the matching `goToNextStep` transition        |
| `goToPreviousStep(steps?)`   | ✅                | ✅                    | ✅                   | Step back through history                                 |
| `goToStepById(id)`           | ✅²               | ✅ if edge defined    | ✅ primary driver    | Jump to a specific step                                   |
| `goToStepByIndex(i)`         | ✅ (linear only)  | —                     | —                    | Jump by position in the ordered step list                 |
| `goToLastVisitedStep()`      | ✅                | ✅                    | ✅                   | Return to the most recently visited step                  |
| `send(event)`                | built-ins only    | ✅ custom events      | ⛔ built-ins, no-op¹ | Drive a custom, named transition (graph's differentiator) |
| `completeJourney(payload?)`  | ✅                | ✅                    | ✅                   | Move to a terminal "completed" state                      |
| `terminateJourney(payload?)` | ✅                | ✅                    | ✅                   | End the journey without completing (cancel/abandon)       |
| `resetJourney()`             | ✅                | ✅                    | ✅                   | Return to the initial snapshot                            |
| `updateContext(updater)`     | ✅                | ✅                    | ✅                   | Patch context immutably                                   |
| `clearStepError(id?)`        | ✅                | ✅                    | ✅                   | Clear async/validation error state for a step             |
| `getSnapshot()`              | ✅                | ✅                    | ✅                   | Read the current authoritative snapshot                   |
| `subscribe* / dispose`       | ✅                | ✅                    | ✅                   | Observe snapshots, events, lifecycle; tear down           |

> ¹ Headless declares no transition graph, so `goToNextStep()` and custom `send(...)` have nothing to match and resolve to a no-op until you add transitions (i.e. move toward linear or graph).
>
> ² Arbitrary forward jumps in Linear succeed only if a `goToStepById` transition exists for that edge; otherwise the call reports `transitioned: false`.

:::info
You are not locked in. The modes are points on a spectrum, not separate products — a linear wizard often grows transitions and becomes a graph; a UI-bound flow often benefits from headless runtime boundaries later. Because the snapshot and runtime are identical, moving between modes is a change to the definition, not a rewrite.
:::

## Design Principles

| Principle                 | What it means                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 🧭 **Transition-first**   | Movement rules live in transitions, not scattered across button handlers — keeping intent visible and reviewable.                            |
| 📸 **Snapshot-persisted** | Runtime state lives in one snapshot: current step, history, context, status, visited state, and async state.                                 |
| 🏷️ **ID-based**           | Steps are referenced by id like `"details"` or `"review"` rather than by array position, so reordering or branching keeps navigation intact. |
| 👁️ **Observable**         | Snapshot subscriptions for rendering, lifecycle events for telemetry — each at the right level of detail.                                    |
| ⏳ **Async-safe**         | Async guards are part of the model, with explicit phases, timeout support, and per-step error state.                                         |

## Under The Hood

### Event Pipeline

Journey processes events through a serialized queue. One event starts, its matching transition resolves, async work settles, the snapshot commits — and only then does the next queued event begin. No overlapping mutations.

![Event Processing Pipeline](/img/journey-event-pipeline.svg)

### Definition vs. Snapshot

The runtime keeps two separate concerns: the static definition (what the flow is) and the live snapshot (where things are now). Definitions stay small and readable; the snapshot is the single authoritative place to inspect current state.

![Definition vs. Snapshot](/img/journey-definition-vs-snapshot.svg)

:::info
Read [Machine Architecture](/docs/core/architecture) for a file-by-file walkthrough of how the runtime is assembled, or [Usage](/docs/core/usage) to see each mode in depth.
:::
