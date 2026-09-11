---
title: "Pinning types with a bag"
---

By default a graph journey infers its types from the definition: step ids from the `steps` record's
keys, event names from each step's `on` keys. A call site declares no generics.

Some types cannot be inferred, because they sit at a property position rather than an inference
site — injected `handlers`, a `meta` shape, the result of a declared `run`. And steps authored in
separate files need to name the shape they satisfy. Both are what the **bag** is for.

## The bag

```ts
type AuthBag = {
  context: LoginContext;
  stepId: "login" | "twofa" | "done";
  events: { type: "submit"; payload: { user: string } } | { type: "verify" };
  meta?: { title: string };
  handlers?: { isAdmin(role: string): boolean };
  results?: { verify: { ok: boolean } };
};
```

`context`, `stepId` and `events` are required. `meta`, `handlers` and `results` are optional and
fall back — metadata to `Record<string, unknown>`, handlers to an empty record, results to
`unknown`.

`results` is load-bearing rather than a convenience. A declared `run` sits at a property position,
so `commit`'s `result` is `unknown` unless the bag pins it. One result type per event name, not per
(step, event) pair.

## `withGraphTypes` — pinning at the call

```ts
const login = withGraphTypes<AuthBag>()({
  initial: "login",
  context: initialContext,
  steps: {
    login: { on: { submit: "twofa" } },
    twofa: {
      on: {
        verify: {
          run: ({ handlers }) => handlers.verify(),
          commit: ({ result, updateContext }) =>
            updateContext((context) => ({ ...context, ok: result.ok })),
          candidates: [{ to: "done", when: ({ context }) => context.ok }, { to: "twofa" }]
        }
      }
    },
    done: {}
  }
});
```

The definition is now _checked_ against the bag rather than read for types. `withLinearTypes` is the
linear twin, and `@rxova/journey-react/graph` exports its own `withGraphTypes` returning a bundle.

These are standalone functions rather than a `.withTypes` property on the factory. Attaching one
would be a module-level side effect, and that defeats tree-shaking badly enough that importing only
`createLinearJourney` pulled the entire graph tier into the bundle.

## `GraphStep` — steps in their own files

```ts
// steps/login.step.ts
import type { GraphStep } from "@rxova/journey-core";
import type { AuthBag } from "../types";

export const loginStep: GraphStep<AuthBag> = {
  metadata: { title: "Sign in" },
  onLeave: ({ snapshot }) => analytics.track("login_left", snapshot.context),
  on: {
    submit: [
      { to: "admin", when: ({ context, handlers }) => handlers.isAdmin(context.role) },
      { to: "dashboard" }
    ]
  }
};
```

Compose them into the `steps` record keyed by id:

```ts
const definition = {
  initial: "login",
  context: initialContext,
  steps: { login: loginStep, dashboard: dashboardStep, admin: adminStep }
} satisfies GraphDefinition<AuthBag>;

export const journey = withGraphTypes<AuthBag>()(definition);
```

## `GraphDefinition` — one definition, several machines

`withGraphTypes` pins a definition it is handed directly. When the same definition is created once and
passed to the factory more than once — different options per call, a fake client in tests —
annotate it instead:

```ts
export const definition = {
  initial: "login",
  context: initialContext,
  handlers: realApi,
  steps: { login: loginStep, done: {} }
} satisfies GraphDefinition<AuthBag>;

const live = withGraphTypes<AuthBag>()(definition);
const underTest = withGraphTypes<AuthBag>()(definition, { handlers: fakeApi });
```

Annotate the context separately when the definition is a standalone `const`. `satisfies` preserves
literal types, so an inline `{ dirty: false }` pins the field to `false` and rejects every later
update:

```ts
const initialContext: LoginContext = { user: "", dirty: false };
```

## Where to next

- [Transitions syntax](./transitions-syntax)
- [Graph](../usage/graph)
- [TypeScript](../typescript)
