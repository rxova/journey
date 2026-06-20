---
id: headless
title: Headless
sidebar_label: Headless
---

# Headless

Headless mode has no transition graph at all. The caller drives navigation with `goToStepById`, and
the machine still tracks everything else — history, context, visited state, async — it just doesn't
constrain where you can go. This is the mode for flows whose path is decided _outside_ the flow.

:::info Good fit
Server-assisted flows, custom renderers, non-React environments, telemetry-heavy orchestration —
anywhere the next step comes from external state the flow can't know about.
:::

## Define a headless journey

Provide `initial`, `context`, and a flat `steps` record. There's no `transitions` field — it isn't
allowed on a headless definition.

```ts
import { createHeadlessJourney } from "@rxova/journey-core";

type StepId = "intro" | "configure" | "preview" | "confirm";
type Context = { name: string; settings: Record<string, unknown> };

const machine = createHeadlessJourney<Context, StepId>({
  initial: "intro",
  context: { name: "", settings: {} },
  steps: { intro: {}, configure: {}, preview: {}, confirm: {} }
});

await machine.startJourney();
```

Steps can still carry metadata, even without transitions:

```ts
type StepMeta = { title: string; description: string };

const machine = createHeadlessJourney<Context, StepId, StepMeta>({
  initial: "intro",
  context: { name: "", settings: {} },
  steps: {
    intro: { meta: { title: "Introduction", description: "Get started" } },
    configure: { meta: { title: "Configuration", description: "Set your options" } }
    // ...
  }
});
```

## Navigation

`goToStepById` is the primary move. It works unconditionally — no guards, no graph to satisfy:

```ts
await machine.goToStepById("configure"); // intro → configure
await machine.goToStepById("preview"); // configure → preview
await machine.goToStepById("intro"); // jump straight back
```

The history-aware helpers still work, because history is part of the runtime, not the transition
graph:

```ts
await machine.goToPreviousStep(); // move the pointer back
await machine.goToLastVisitedStep(); // return to the realized tail
```

:::note
`goToNextStep()` and `send({ type })` are no-ops here — there are no transitions for them to match.
The moment you want event-driven navigation, add a `transitions` map and switch to
[`createGraphJourney`](./graph).
:::

## The caller-driven pattern

The shape of a headless flow is always the same: read external state, decide the next step, navigate.

```ts
await machine.startJourney(); // starts on "intro"

const resumeStep = await api.getResumeStep(userId);
if (resumeStep) {
  await machine.goToStepById(resumeStep);
}

// Later, after a user action:
const next = computeNextStep(machine.getSnapshot().context);
await machine.goToStepById(next);
```

Because the full observable API is available, your UI and analytics wire up exactly as they do in the
other modes:

```ts
machine.subscribe(() => render(machine.getSnapshot()));
machine.subscribeEvent((event) => analytics.track(event.type, event));
```

## A complete flow

A server-orchestrated flow that routes to an error step whenever a call fails:

```ts
import { createHeadlessJourney } from "@rxova/journey-core";

type StepId = "loading" | "form" | "verify" | "success" | "error";
type Context = { userId: string | null; token: string | null };

const machine = createHeadlessJourney<Context, StepId>({
  initial: "loading",
  context: { userId: null, token: null },
  steps: { loading: {}, form: {}, verify: {}, success: {}, error: {} }
});

await machine.startJourney();
machine.subscribe(() => render(machine.getSnapshot()));

try {
  const session = await api.getSession();
  await machine.updateContext((ctx) => ({ ...ctx, userId: session.userId }));
  await machine.goToStepById("form");
} catch {
  await machine.goToStepById("error");
}

async function handleSubmit(formData: FormData) {
  try {
    const token = await api.submit(formData);
    await machine.updateContext((ctx) => ({ ...ctx, token }));
    await machine.goToStepById("verify");
  } catch {
    await machine.goToStepById("error");
  }
}
```

## Where to next

- [Graph](./graph) — move routing back into the flow when external orchestration is more than you need.
- [Timeline & history](/docs/core/history) — how `goToStepById` builds the realized timeline.
- [Snapshot](/docs/core/snapshot) — the state your renderer reads.
