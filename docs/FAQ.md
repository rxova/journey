# FAQ

## Is this a router?

No. It is an in-memory journey engine for step-based UI, commonly inside modals or forms.

## Why not a doubly linked list?

Real flows branch and skip dynamically. A transition graph with history handles those cases better.

## What happens if multiple transitions match?

The first matching transition in `transitions` order is used.

## Can guards be async?

Yes. `when` can return `Promise<boolean>`.

`when` means "is this transition allowed right now?"

## Can effects be async?

Yes. `effect` can return `Promise<context | void>`.

`effect` means "run work while taking the transition, and optionally return updated context."

## What is the practical difference between `when` and `effect`?

- Use `when` to gate movement (`true`/`false`).
- Use `effect` to do side effects (API, save draft, etc).

If you use `when` for side effects, those effects may run even when transition does not complete as expected.

## Is `back` always linear?

`back` is based on visited history when you use `HISTORY_TARGET`.

## Can I close immediately?

Yes. Route `close` to `JOURNEY_TERMINAL.CLOSE`.

## Can I enforce close confirmation?

Yes. Route `close` to a `confirmClose` step when `context.dirty === true`.

## Do transitions race if a user clicks quickly?

No. `send` calls are serialized in a queue.

## What happens when `when` or `effect` throws?

- `send(...)` rejects with that error.
- Step async state becomes `error`.
- Error is available in `snapshot.async.byStep[currentStep].error`.
- You can clear it with `clearStepError(stepId?)`.

## Does persistence include async loading/error state?

No.

Persistence stores `current`, `context`, `history`, and `terminal`.
`snapshot.async` is runtime-only and starts clean (`idle`) after hydrate/reset.

## Does this include runtime dependencies?

No runtime dependencies. `react` is a peer dependency for React bindings.
