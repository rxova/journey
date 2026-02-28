---
title: Async Behavior
sidebar_position: 6
---

Journey supports async guards and effects while keeping deterministic ordering.

## Async Guards (`when`)

Use `when` to answer: **is transition allowed now?**

```ts
{
  from: "payment",
  event: "goToNextStep",
  to: "review",
  when: async ({ context }) => {
    const validation = await validateCard(context.cardToken);
    return validation.ok;
  }
}
```

## Async Effects (`effect`)

Use `effect` for side effects and optional context updates.

```ts
{
  from: "details",
  event: "goToNextStep",
  to: "review",
  effect: async ({ context }) => {
    const draft = await saveDraft(context);
    return { ...context, draftId: draft.id };
  }
}
```

### When `effect` Runs

For `send(event)`:

1. Machine emits `transition.start`.
2. Runtime scans transitions in order (first match wins).
3. Candidate transition must match `from` + `event`.
4. If a `when` guard exists, it must resolve `true`.
5. If the selected transition has `effect`, runtime executes it.
6. After effect resolves, runtime commits navigation/status and emits success events.

This means `effect` runs after selection/guarding and before `step.exit` / `transition.success` are emitted.

### Conditions For `effect` To Run

- Machine status must be `running`.
- A transition must be selected for the event.
- The selected transition must define `effect`.
- If `when` exists on that transition, it must pass.

`effect` does not run when no transition matches, when a guard blocks selection, or when status is terminal.

### Effect Failures

If `effect` throws/rejects:

- machine emits `transition.error`
- async phase for the source step becomes `error`
- navigation is not committed

## Observable Async Phases

- `idle`
- `evaluating-when`
- `running-effect`
- `error`

Read from `snapshot.async.byStep[stepId]`.

## UI Integration Pattern

```ts
const step = snapshot.currentStepId;
const asyncState = snapshot.async.byStep[step];

if (asyncState.phase === "running-effect") {
  return <Spinner />;
}

if (asyncState.phase === "error") {
  return <ErrorPanel onDismiss={() => api.clearStepError(step)} />;
}
```

## Recommendations

- Keep guards pure and fast when possible.
- Add `id` to important transitions for debugging.
- Do retries outside guards if failure is expected/transient.
- Avoid mixing navigation decisions inside UI components.
