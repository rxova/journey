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

| Form                                        | Meaning                                               |
| ------------------------------------------- | ----------------------------------------------------- |
| `SUBMIT: "review"`                          | One unguarded candidate. The shorthand.               |
| `SUBMIT: [{ to, when?, onTransition? }, …]` | Ordered candidates; the first enabled one wins.       |
| `SUBMIT: { run, commit?, candidates }`      | Async the machine owns, routed by the staged context. |

A guarded lone candidate is written `[{ to, when }]`. The extra brackets are deliberate: a guarded
lone candidate means the event can fail, and the array form is where that reads honestly.

| Candidate field | Purpose                                                       |
| --------------- | ------------------------------------------------------------- |
| `to`            | Required destination step. Self-transitions are allowed.      |
| `when`          | Optional synchronous guard receiving `{ context, handlers }`. |
| `onTransition`  | Optional post-commit effect receiving hook arguments.         |

Declaration order is priority order, per step and then per event. The same event may be declared
from several steps; candidates are matched against the current step before order is consulted, so
those declarations never interfere.

## Validation

Factories reject empty definitions, duplicate linear ids, unknown graph initial steps, and
transitions pointing at undeclared steps. A source step cannot be undeclared — it is the key the
entry is written under. Graph guards that throw are treated as disabled.

## Where to next

- [Linear](../usage/linear)
- [Graph](../usage/graph)
- [Graph builder](./graph-builder)
