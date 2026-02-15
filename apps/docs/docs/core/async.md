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
  event: "next",
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
  event: "next",
  to: "review",
  effect: async ({ context }) => {
    const draft = await saveDraft(context);
    return { ...context, draftId: draft.id };
  }
}
```

## Observable Async Phases

- `idle`
- `evaluating-when`
- `running-effect`
- `error`

Read from `snapshot.async.byStep[stepId]`.

## UI Integration Pattern

```ts
const step = snapshot.current;
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
