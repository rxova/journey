---
id: typescript
title: TypeScript
---

# TypeScript

Journey infers linear step ids from tuples and supports explicit graph event unions for exact send
payloads.

## Linear inference

```ts
const machine = createLinearJourney({
  steps: [
    { id: "account", metadata: { title: "Account" } },
    { id: "review", metadata: { title: "Review" } }
  ] as const,
  context: { email: "" }
});

await machine.navigate.goToStepById("review");
// await machine.navigate.goToStepById("missing"); // TypeScript error
```

Keep the step array literal or use `as const` so ids do not widen to `string`.

## Typed graph events

```ts
type Context = { code: string };
type StepId = "form" | "done";
type Event = { type: "SUBMIT"; payload: { code: string } } | { type: "RESET" };

const machine = createGraphJourney<Context, StepId, Event>({
  initial: "form",
  context: { code: "" },
  steps: { form: {}, done: {} },
  transitions: {
    SUBMIT: { from: "form", to: "done" },
    RESET: { from: "done", to: "form" }
  }
});

await machine.send("SUBMIT", { code: "1234" });
await machine.send("RESET");
```

Payload arguments are required only for union members that declare `payload`.

## Type bag builder

For definitions split across files, declare all domain types once:

```ts
const builder = createGraphJourneyBuilder<{
  context: Context;
  stepId: StepId;
  events: Event;
  meta: StepMetadata;
  handlers: Handlers;
}>();
```

The builder narrows callback-form transition payloads and validates source/target ids at compile
time.

## Snapshot narrowing

```ts
type Snapshot = ReturnType<typeof machine.getSnapshot>;

function progress(snapshot: JourneySnapshot) {
  if (snapshot.type === "linear") {
    return snapshot.currentStep?.index ?? 0;
  }
  return snapshot.availableSteps.length;
}
```

Prefer concrete machine snapshot types in application selectors; use exported generic snapshot
types for reusable helpers.

## Plugin tuples

Plugin API inference depends on preserving the plugin tuple:

```ts
const plugins = [createReplayPlugin(), createDiagnosticsPlugin()] as const;
const machine = createLinearJourney(definition, { plugins });

machine.plugins.replay.getReplaySession();
machine.plugins.diagnostics.getDiagnostics();
```

## Context updates

`ContextUpdater<T>` receives and returns the complete context type:

```ts
machine.context.update((previous) => ({ ...previous, code: "5678" }));
```

Journey does not merge partial objects.

## Where to next

- [Graph builder](./api/graph-builder)
- [Snapshot](./snapshot)
- [Writing a plugin](./plugins/authoring)
