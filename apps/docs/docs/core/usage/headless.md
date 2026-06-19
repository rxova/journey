---
id: headless
title: Headless
sidebar_label: Headless
---

# Headless

`createHeadlessJourney` creates a machine with no predefined transition graph. Navigation is entirely caller-driven via `goToStepById`. The machine still tracks history, context, visited state, and async state — it just doesn't constrain which step you can go to.

:::info Good fit
Custom renderers, server-assisted flows, non-React environments, telemetry-heavy orchestration, or any flow where the caller decides the path at runtime based on external state.
:::

## Define a Headless Journey

Provide `initial`, `context`, and a flat `steps` record. No `transitions` field — it is not allowed on headless definitions.

```ts
import { createHeadlessJourney } from "@rxova/journey-core";

type StepId = "intro" | "configure" | "preview" | "confirm";
type Context = { name: string; settings: Record<string, unknown> };

const machine = createHeadlessJourney<Context, StepId>({
  initial: "intro",
  context: { name: "", settings: {} },
  steps: {
    intro: {},
    configure: {},
    preview: {},
    confirm: {}
  }
});

await machine.startJourney();
```

## Navigation

`goToStepById` is the primary navigation method. It works unconditionally — no guards, no transition graph.

```ts
await machine.goToStepById("configure"); // intro → configure
await machine.goToStepById("preview"); // configure → preview
await machine.goToStepById("intro"); // jump back
```

History-aware fallbacks still work:

```ts
await machine.goToPreviousStep(); // move history pointer back
await machine.goToLastVisitedStep(); // return to current tail
```

:::note
`goToNextStep()` and `send({ type })` are no-ops in headless mode unless you add transitions. Add a `transitions` map and switch to `createGraphJourney` when you need event-driven navigation.
:::

## Step Metadata

Steps can carry static metadata even without transitions:

```ts
type StepMeta = { title: string; description: string };

const machine = createHeadlessJourney<Context, StepId, StepMeta>({
  initial: "intro",
  context: { name: "", settings: {} },
  steps: {
    intro: { meta: { title: "Introduction", description: "Get started" } },
    configure: { meta: { title: "Configuration", description: "Set your options" } },
    preview: { meta: { title: "Preview", description: "Review before saving" } },
    confirm: { meta: { title: "Confirm", description: "Finalize" } }
  }
});

const meta = machine.getStepMeta("configure");
```

## Observing State

The full observable API is available:

```ts
machine.subscribe(() => {
  const snap = machine.getSnapshot();
  render(snap.currentStepId, snap.context);
});

machine.subscribeEvent((event) => {
  analytics.track(event.type, event);
});
```

## Caller-Driven Pattern

The typical headless pattern: read external state, decide the next step, navigate:

```ts
await machine.startJourney(); // starts on "intro"

const serverStep = await api.getResumeStep(userId);
if (serverStep) {
  await machine.goToStepById(serverStep);
}

// Later, after user action:
const nextStep = computeNextStep(machine.getSnapshot().context);
await machine.goToStepById(nextStep);
```

## Full Example

```ts
import { createHeadlessJourney } from "@rxova/journey-core";

type StepId = "loading" | "form" | "verify" | "success" | "error";
type Context = { userId: string | null; token: string | null };

const machine = createHeadlessJourney<Context, StepId>({
  initial: "loading",
  context: { userId: null, token: null },
  steps: {
    loading: {},
    form: {},
    verify: {},
    success: {},
    error: {}
  }
});

await machine.startJourney();

machine.subscribe(() => {
  renderFromSnapshot(machine.getSnapshot());
});

// Orchestrate navigation from outside
try {
  const session = await api.getSession();
  await machine.updateContext((ctx) => ({ ...ctx, userId: session.userId }));
  await machine.goToStepById("form");
} catch {
  await machine.goToStepById("error");
}

// After form submission
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
