---
title: "React Overview"
sidebar:
  label: "Overview"
---

`@rxova/journey-react` is a thin, typed React wrapper around `@rxova/journey-core`.

## Motivation

See the Core motivation: [Core Motivation](../core/overview.md#motivation).

## Architecture

React bindings are a wrapper layer, not a second runtime.

`createJourney(definition, options?)` creates the core machine immediately in `status: "idled"` and returns a `JourneyRuntime` bundle:

- `machine`
- `dispose()`
- `useJourneySnapshot()`
- `useJourneyComputed()`
- `useJourneySelector(selector, equalityFn?)`
- `useStepAsyncState(stepId)`
- `useJourneyApi()`
- `useStepApi(stepId)`
- `useJourneyEvent(listener)`
- `useJourneyStepLifecycle(stepId, callbacks)`
- `JourneyProvider`
- `StepRenderer`

Hooks work without a provider for reads and manual control. `useJourneyApi()` includes `startJourney()` for provider-free flows, and `JourneyProvider` supplies the `views` map, lifecycle callbacks, and client-side auto-start for an `idled` machine.

### Named factories, mirrored from Core

Like Core, React exposes a factory per flow shape — `createLinearJourney`, `createHeadlessJourney`,
and `createGraphJourney` — each wrapping the matching core factory and returning the same React
runtime bundle. Reach for the one that matches your flow; they buy you tighter inference (the graph
builder runtime even types `useStepApi` per step). `createJourney(definition)` stays as the generic
entry point that accepts any definition shape, and `createJourneyFactory(...)` returns a thunk that
mints a fresh runtime per call (one per request, card, or route boundary).

:::info Choosing a factory
The decision is the same as Core's — see [Choosing a mode](/docs/core/usage). React adds nothing to
that choice; it only wraps the result in hooks and a provider.
:::

## Runtime Ownership

`createJourney(...)` is stateful.

- One call creates one machine instance immediately.
- The returned hooks and components stay bound to that specific machine instance.
- Reusing that returned runtime across multiple providers reuses the same journey state.
- Creating a second independent journey means calling `createJourney(...)` again.

This is also what keeps the API strongly typed. Once the journey is created, the returned React API already knows the valid step ids, event names, and payload shapes.

The compatibility promises for that model are documented in the shared [Stability Contract](../core/stability.md).

For the runtime architecture model, read [Core Machine Architecture](../core/architecture.md), especially the
file-level pages in that section.

## TypeScript In React

TypeScript stays first-class here too.

`createJourney(...)` captures journey types once, then the returned hooks and components stay typed without repeating generics at each callsite.

For deeper type modeling such as events, payload maps, and snapshots, see [Core TypeScript](../core/typescript.md).

## What The React Package Gives You

- `createJourney(definition, options?)` plus the named `createLinearJourney` /
  `createHeadlessJourney` / `createGraphJourney` factories
- hooks bound to the created machine
- `useJourneyComputed()` for derived progress state and lifecycle flags
- `useStepAsyncState(stepId)` for a step's async phase, driving loading and error UI
- `useStepApi(stepId)` for step-scoped custom event typing
- `useJourneyStepLifecycle(stepId, callbacks)` for step enter/leave side effects
- a `JourneyProvider` for `views` and lifecycle callbacks
- a `StepRenderer` that renders the current step view

This keeps React ergonomic without moving runtime logic into components.

Create the runtime outside render when possible. If a component must own it, memoize it and either set `disposeOnUnmount` on `JourneyProvider` or call `dispose()` manually so you do not recreate journey state on every render.

If you need isolated state per request, per card, or per mounted route boundary, create a separate runtime in each owned boundary instead of reusing one module singleton.

## React Example

This example uses every step option — `meta`, `onEnter`, `onLeave`, `effect`, and `after` — and a typed `applyCoupon` payload that validates the code, records a discount, and advances to review. Applying a coupon is a real transition; for a context change that should _not_ navigate, call `api.updateContext(...)` instead — a self-transition (`to` equal to the current step) re-runs `onEnter` and resets the step's `after` timer.

```tsx
import React from "react";
import { createJourney, type JourneyViews } from "@rxova/journey-react";
import type { JourneyDefinition } from "@rxova/journey-core";

// Stand-ins for your own services.
declare const analytics: { track: (event: string, props?: Record<string, unknown>) => void };
declare function submitOrder(
  input: { couponCode: string | null; discountPct: number },
  signal: AbortSignal
): Promise<{ orderId: string }>;

type StepId = "details" | "payment" | "review" | "placingOrder" | "confirmation";
type Context = {
  isVip: boolean;
  couponCode: string | null;
  discountPct: number;
  orderId: string | null;
};
// The payload reaches `when`, `updateContext`, and `api.send` fully typed.
type EventMap = { applyCoupon: { code: string } };

const definition: JourneyDefinition<Context, StepId, EventMap> = {
  initial: "details",
  context: { isVip: false, couponCode: null, discountPct: 0, orderId: null },
  steps: {
    details: {
      meta: { title: "Your details" },
      onEnter: ({ context }) => analytics.track("checkout_started", { isVip: context.isVip }),
      onLeave: ({ context }) => analytics.track("details_completed", { coupon: context.couponCode })
    },
    payment: {
      meta: { title: "Payment" },
      onEnter: () => analytics.track("payment_viewed"),
      // Delayed transition: abandon the payment session after 10 minutes.
      // The timer starts on entry and is cancelled on exit, reset, or dispose.
      after: {
        600000: { to: "details", label: "payment-session-expired" }
      }
    },
    review: {
      meta: { title: "Review order" },
      onEnter: ({ context }) =>
        analytics.track("review_viewed", { discountPct: context.discountPct })
    },
    placingOrder: {
      meta: { title: "Placing your order" },
      // Declarative async work: runs on entry, is cancelled via `signal` on
      // exit/reset/dispose, and routes its result to onResolved / onRejected.
      effect: {
        run: ({ context, signal }) =>
          submitOrder({ couponCode: context.couponCode, discountPct: context.discountPct }, signal),
        timeoutMs: 8000,
        onResolved: {
          to: "confirmation",
          // In the declarative form `output` is typed `unknown`; narrow it here.
          updateContext: ({ context, output }) => ({
            ...context,
            orderId: (output as { orderId: string }).orderId
          })
        },
        onRejected: { to: "payment", label: "order-submission-failed" }
      }
    },
    confirmation: {
      meta: { title: "Order confirmed" },
      onEnter: ({ context }) => analytics.track("order_confirmed", { orderId: context.orderId })
    }
  },
  transitions: {
    details: {
      // VIP customers skip payment and go straight to review.
      goToNextStep: [
        { to: "review", when: ({ context }) => context.isVip },
        { to: "payment", when: ({ context }) => !context.isVip }
      ]
    },
    payment: {
      goToNextStep: [{ to: "review" }],
      // A valid coupon records the discount and advances to review. An empty
      // code fails the guard, so the event is a no-op — no transition, no re-entry.
      applyCoupon: [
        {
          to: "review",
          when: ({ event }) => (event.payload?.code.trim().length ?? 0) > 0,
          updateContext: ({ context, event }) => {
            const code = event.payload?.code.trim() ?? "";
            return { ...context, couponCode: code, discountPct: code === "VIP50" ? 50 : 10 };
          }
        }
      ]
    },
    review: {
      goToNextStep: [{ to: "placingOrder" }]
    }
  }
};

const checkoutJourney = createJourney(definition);

const Details = () => {
  const api = checkoutJourney.useJourneyApi();
  return <button onClick={() => void api.goToNextStep()}>Continue</button>;
};

const Payment = () => {
  const api = checkoutJourney.useJourneyApi();
  const [code, setCode] = React.useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void api.send({ type: "applyCoupon", payload: { code } });
      }}
    >
      <input
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Coupon code"
      />
      <button type="submit">Apply coupon</button>
      <button type="button" onClick={() => void api.goToNextStep()}>
        Continue without coupon
      </button>
    </form>
  );
};

const Review = () => {
  const api = checkoutJourney.useJourneyApi();
  const couponCode = checkoutJourney.useJourneySelector((snapshot) => snapshot.context.couponCode);
  const discountPct = checkoutJourney.useJourneySelector(
    (snapshot) => snapshot.context.discountPct
  );

  return (
    <div>
      {couponCode ? (
        <p>
          Coupon {couponCode} applied — {discountPct}% off.
        </p>
      ) : (
        <p>No coupon applied.</p>
      )}
      <button onClick={() => void api.goToNextStep()}>Place order</button>
    </div>
  );
};

const PlacingOrder = () => {
  const asyncState = checkoutJourney.useStepAsyncState("placingOrder");
  return (
    <p>{asyncState.phase === "error" ? "Could not place your order." : "Placing your order…"}</p>
  );
};

const Confirmation = () => {
  const api = checkoutJourney.useJourneyApi();
  const orderId = checkoutJourney.useJourneySelector((snapshot) => snapshot.context.orderId);
  return (
    <div>
      <p>Order {orderId} confirmed.</p>
      <button onClick={() => void api.completeJourney()}>Done</button>
    </div>
  );
};

const views: JourneyViews<StepId> = {
  details: Details,
  payment: Payment,
  review: Review,
  placingOrder: PlacingOrder,
  confirmation: Confirmation
};

export const App = () => (
  <checkoutJourney.JourneyProvider views={views}>
    <checkoutJourney.StepRenderer />
  </checkoutJourney.JourneyProvider>
);
```

Guard and `updateContext` failures resolve through `result.error` instead of rejecting, so fire-and-forget button handlers like `void api.goToNextStep()` do not surface as unhandled promise rejections.

The `effect` on `placingOrder` is the idiomatic async pattern: it runs on entry, surfaces its progress through `useStepAsyncState` / `isLoading`, and routes success to `confirmation` and failure back to `payment` — no imperative submit handler required.

## What Still Lives In Core

React bindings do not redefine runtime behavior.

Core docs remain the source of truth for:

- architecture and transition model: [Core Architecture](../core/architecture.md)
- snapshot shape and invariants: [Core Snapshot](../core/snapshot.md)
- lifecycle events and ordering: [Core Lifecycle](../core/lifecycle.md)
- async guard behavior: [Core Async Behavior](../core/async.md)
- timeline navigation model: [Core Timeline Navigation](../core/history.md)
- persistence and migration: [Core Persistence](../core/persistence.md)
- full machine API semantics: [Core API](../core/api/overview.md)

## Why This Split Is Useful

- Core stays deterministic and framework-agnostic.
- React stays focused on rendering and hook ergonomics.
- Teams debug runtime behavior with Core mental models, then implement UI with React bindings.

## One-Line Mental Model

Use React docs for how to wire Journey into React.
Use Core docs for how Journey works under the hood.

## Where to next

- [Quickstart](./quickstart) — install and wire a flow into React in a few minutes.
- [Provider & hooks](./provider-and-hooks) — the full hook and provider surface.
- [Async UI](./async-ui) — render loading and error states with `useStepAsyncState`.
- [Choosing a mode](/docs/core/usage) — pick linear, graph, or headless for your flow.
