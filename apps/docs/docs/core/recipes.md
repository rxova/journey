---
title: Recipes
sidebar_position: 3
---

Copy these patterns directly into Core journeys.

## 1. Global Back With History

```ts
import { HISTORY_TARGET } from "@rxova/journey-core";

{ from: "*", event: "back", to: HISTORY_TARGET }
```

## 2. Optional Step (Skip Pattern)

```ts
{
  from: "details",
  event: "next",
  to: "optional",
  when: ({ context }) => context.needsOptional
},
{
  from: "details",
  event: "next",
  to: "review",
  when: ({ context }) => !context.needsOptional
}
```

## 3. Confirm Close If Dirty

```ts
import { JOURNEY_TERMINAL } from "@rxova/journey-core";

{
  from: "*",
  event: "close",
  to: "confirmExit",
  when: ({ context }) => context.dirty
},
{
  from: "*",
  event: "close",
  to: JOURNEY_TERMINAL.CLOSE,
  when: ({ context }) => !context.dirty
}
```

## 4. Complete Journey on Submit

```ts
{ from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
```

## 5. Custom Event (`retry`)

```ts
type Event = "next" | "back" | "close" | "submit" | "retry";

{
  from: "error",
  event: "retry",
  to: "details"
}

await machine.send({ type: "retry" });
```

## 6. Async Guard

```ts
{
  id: "validate-payment",
  from: "payment",
  event: "next",
  to: "review",
  when: async ({ context }) => {
    const result = await validatePayment(context.cardToken);
    return result.ok;
  }
}
```

## 7. Async Effect That Updates Context

```ts
{
  id: "save-draft",
  from: "details",
  event: "next",
  to: "review",
  effect: async ({ context }) => {
    const saved = await saveDraft(context);
    return { ...context, draftId: saved.id };
  }
}
```

## 8. Error Handling Around `send`

```ts
try {
  await machine.send({ type: "next" });
} catch (error) {
  const step = machine.getSnapshot().current;
  const asyncState = machine.getSnapshot().async.byStep[step];
  console.error("transition failed", error, asyncState.error);

  machine.clearStepError(step);
}
```

## 9. Programmatic Jump (`goTo`)

```ts
await machine.send({ type: "goTo", to: "review" });
```

## 10. First-Match-Wins Prioritization

```ts
transitions: [
  {
    id: "priority-path",
    from: "details",
    event: "next",
    to: "manualReview",
    when: ({ context }) => context.riskScore > 80
  },
  {
    id: "default-path",
    from: "details",
    event: "next",
    to: "confirm"
  }
];
```

Put the highest-priority rule first.

## 11. Manual History Control

```ts
machine.trimHistory(5); // keep latest 5 entries
machine.clearHistory(); // clear all entries
```

## 12. Bounded History With Overflow Observability

```ts
const machine = createJourneyMachine(journey, {
  history: {
    maxHistory: 20,
    onOverflow: ({ previous, next, trimmed, reason }) => {
      auditHistoryTrim({ previous, next, trimmed, reason });
    }
  }
});
```

`reason` is `"auto" | "hydrate" | "manual"`.

## 13. Persist + Migrate Snapshot

```ts
const machine = createJourneyMachine(journey, {
  persistence: {
    key: "checkout-journey",
    version: 2,
    migrate: (snapshot, persistedVersion) => {
      if (persistedVersion === 1) {
        const v1 = snapshot as { context?: { legacyName?: string } };
        return {
          current: "details",
          context: { name: v1.context?.legacyName ?? "", dirty: false },
          history: ["start"],
          visited: ["start", "details"],
          status: "running"
        };
      }

      return snapshot as {
        current: "start" | "details" | "review";
        context: { name: string; dirty: boolean };
        history: Array<"start" | "details" | "review">;
        visited: Array<"start" | "details" | "review">;
        status: "running" | "complete" | "closed";
      };
    }
  }
});
```

## 14. Subscribe for Logging/Analytics

```ts
const unsubscribe = machine.subscribe(() => {
  const snapshot = machine.getSnapshot();
  track("journey_changed", {
    current: snapshot.current,
    status: snapshot.status,
    historyDepth: snapshot.history.length
  });
});

unsubscribe();
```
