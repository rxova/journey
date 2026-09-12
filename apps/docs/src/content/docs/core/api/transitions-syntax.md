---
title: "Transitions syntax"
---

Linear order and graph events are separate definition forms.

## Linear steps

```ts
const definition = {
  context: { valid: false },
  steps: [
    "intro",
    {
      id: "form",
      metadata: { title: "Form" },
      onLeave: ({ snapshot }) => analytics.track("form_left", snapshot.context)
    },
    {
      id: "done",
      onEnter: ({ snapshot }) => report(snapshot.context)
    }
  ] as const
};
```

The array order controls initial selection, next-step fallback, and linear snapshot indices. A bare
string is shorthand for `{ id, metadata: {} }`.

## Graph transitions

A graph step declares its own outgoing transitions under `on`, keyed by event. There is no `from`:
the step that declares an entry _is_ the source.

```ts
const definition = {
  initial: "form" as const,
  context: { valid: false },
  steps: {
    form: {
      on: {
        SUBMIT: [{ to: "review", when: ({ context }) => context.valid }, { to: "form" }]
      }
    },
    review: {
      on: {
        APPROVE: [{ to: "done", onTransition: ({ raise }) => raise({ type: "AUDIT" }) }]
      }
    },
    done: {}
  }
};
```

### The three forms

One event maps to one of three things, told apart at the top level — nothing has to look inside a
candidate to know which it is:

| Form                                   | Meaning                                               |
| -------------------------------------- | ----------------------------------------------------- |
| `SUBMIT: "review"`                     | One unguarded candidate. The shorthand.               |
| `SUBMIT: [{ to, … }, …]`               | Ordered candidates; the first enabled one wins.       |
| `SUBMIT: { run, commit?, candidates }` | Async the machine owns, routed by the staged context. |

A guarded lone candidate is written `[{ to, when }]`. The extra brackets are deliberate: a guarded
lone candidate means the event can fail, and the array form is where that reads honestly.

| Candidate field | Purpose                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `to`            | Required destination step. Self-transitions are allowed.                 |
| `when`          | Optional synchronous guard receiving `{ context, handlers }`.            |
| `onTransition`  | Optional post-commit effect receiving hook arguments.                    |
| `label`         | Optional name for this edge, used wherever the edge has to be named.     |
| `timeoutMs`     | Optional budget for this edge's `onTransition`, over the global default. |

Declaration order is priority order, per step and then per event. The same event may be declared
from several steps; candidates are matched against the current step before order is consulted, so
those declarations never interfere.

### Naming an edge

Several candidates on one event differ only by guard, so `event` and `to` do not identify which one
fired. `label` does:

```ts
on: {
  PAY: [
    { to: "review", label: "needs-review", when: ({ context }) => context.tier === "free" },
    { to: "review", label: "flagged", when: ({ context }) => context.flagged },
    { to: "done", label: "straight-through" }
  ];
}
```

The name then shows up in three places: timeout and error messages (`onTransition(needs-review)
timed out after 5000ms`), the `transition` argument every step hook receives, and the structure view
plugins and [`analyzeStructure`](./analyze-structure) read.

Labels are optional. An unlabelled edge is described by its declaration index instead —
`PAY[1] (checkout -> review)` — and reports `label: null` with its `index`.

### Bounding one edge's async

`defaultTimeoutMs` on the factory is the fallback, not the only dial. An edge that calls something
slow declares its own budget, and the rest of the graph keeps the tighter default:

```ts
const machine = createGraphJourney(definition, { defaultTimeoutMs: 2_000 });

// ...in the definition:
on: {
  SUBMIT: {
    run: ({ handlers }) => handlers.creditCheck(),  // third party, occasionally slow
    label: "credit-check",
    timeoutMs: 30_000,
    candidates: [{ to: "approved" }, { to: "declined" }]
  }
}
```

`timeoutMs` on a work entry bounds its `run`; on a candidate it bounds that candidate's
`onTransition`. Caller-supplied navigation work takes it too:
`goToNextStep({ run, timeoutMs: 30_000 })`. It must be a finite number greater than zero, checked
when the definition is built rather than when the timer first matters.

## Validation

Factories reject empty definitions, duplicate linear ids, unknown graph initial steps, and
transitions pointing at undeclared steps. A source step cannot be undeclared — it is the key the
entry is written under. Graph guards that throw are treated as disabled.

## Where to next

- [Linear](../usage/linear)
- [Graph](../usage/graph)
- [Pinning types with a bag](./with-types)
