---
title: Async Behavior
sidebar_position: 6
---

Journey treats async work as a first-class part of flow logic, not an afterthought.

That means async guards and effects stay deterministic, observable, and easier to debug.

## Async Guards (`when`)

Use `when` to decide whether a transition is allowed right now.

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

Think of guards as permission checks.

## Async Effects (`effect`)

Use `effect` for side effects and optional context updates tied to transitions.

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

Think of effects as transition work that runs before state commit.

### When `effect` runs

`effect` runs only if all of these are true:

- machine status is `running`
- a transition is selected for the event (first valid match wins)
- the transition guard `when` passes (if present)
- the selected transition defines `effect`

### How `effect` runs

For `send(event)`, Journey processes in this order:

1. Emit `transition.start`.
2. Select the first matching transition.
3. Evaluate `when` (if present).
4. Run `effect` with `{ context, from, timeline, index, event }`.
5. If `effect` returns context, use it as next context.
6. Commit snapshot change and emit success events (`transition.success`, `step.exit`, `step.enter`, etc.).

`effect` can be sync or async. If async, the source step moves through `running-effect` phase until it resolves.

### When `effect` does not run

`effect` does not run when:

- machine is terminal (`complete` or `terminated`)
- no transition matches the event
- the selected transition has no `effect`
- `when` returns `false`
- `when` throws/rejects
- navigation happens via pointer helpers (`goToPreviousStep`, `goToLastVisitedStep`)
- `goToStepById` uses direct-jump fallback because no matching `goToStepById` transition exists

## Failure Behavior

If guard or effect fails:

- Journey emits `transition.error`
- source step async phase becomes `error`
- snapshot navigation is not committed

This prevents partial transitions and keeps state consistent.

## Observable Async Phases

Per-step async phases:

- `idle`
- `evaluating-when`
- `running-effect`
- `error`

Read from `snapshot.async.byStep[stepId]`.

```ts
const phase = snapshot.async.byStep[snapshot.currentStepId].phase;
```

Typical UI mappings:

- `phase === "evaluating-when"`: disable controls or show validating state.
- `phase === "running-effect"`: show submit/loading state.
- `phase === "error"`: show recoverable error UI.
- `phase === "idle"`: render normal interactive step UI.

## UI Pattern

```tsx
const step = snapshot.currentStepId;
const asyncState = snapshot.async.byStep[step];

if (asyncState.phase === "running-effect" || asyncState.phase === "evaluating-when") {
  return <Spinner />;
}

if (asyncState.phase === "error") {
  return <ErrorPanel onDismiss={() => api.clearStepError(step)} />;
}
```

## Recommendations

- Keep guards focused on decisions, not heavy side effects.
- Put important side effects inside transition `effect`.
- Add transition `id` for better production debugging.
- Keep UI components thin; keep flow rules in transitions.
