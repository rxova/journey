---
"@rxova/journey-core": minor
---

Name an edge with `label`, bound one edge's async with `timeoutMs`, and infer a work entry's result
with `defineWork`.

Three gaps, all of them things a graph could express before the type bag replaced the builder.

### `label` on a candidate

Several candidates on one event differ only by guard, so `event` and `to` do not say which one
fired. A priority index says where an edge sits, not what it is.

```ts
on: {
  PAY: [
    { to: "review", label: "needs-review", when: ({ context }) => context.tier === "free" },
    { to: "review", label: "flagged", when: ({ context }) => context.flagged },
    { to: "done", label: "straight-through" }
  ];
}
```

The name then appears in timeout and error messages (`onTransition(needs-review) timed out after
5000ms`), in the new `transition` argument every step hook receives, and in the structure view
plugins and `analyzeStructure` read. Labels stay optional: an unlabelled edge is described by its
declaration index instead — `PAY[1] (checkout -> review)` — and reports `label: null` alongside its
`index`.

`StepHookArgs` gains `transition: TransitionInfo | null`, carrying `{ event, from, to, label, index }`
on hooks that ran for an edge and `null` for the initial entry, timeline moves, and linear
navigation. `JourneyStructure.transitions` gains `label` and `index`.

### `timeoutMs` on a candidate, a work entry, and navigation work

`defaultTimeoutMs` was the only dial, so one edge calling a slow third party forced every other edge
onto the slow one's budget. Each edge can now declare its own, falling back to the global when it
does not:

```ts
const machine = createGraphJourney(definition, { defaultTimeoutMs: 2_000 });

// ...in the definition:
on: {
  SUBMIT: {
    run: ({ handlers }) => handlers.creditCheck(),
    label: "credit-check",
    timeoutMs: 30_000,
    candidates: [{ to: "approved" }, { to: "declined" }]
  }
}
```

On a work entry it bounds `run`; on a candidate it bounds that candidate's `onTransition`;
`NavigationWork` takes it too, so `goToNextStep({ run, timeoutMs })` works the same way. Both new
fields are validated when the definition is built rather than when the timer first matters, under
the new `invalid-label` and `invalid-timeout` error codes.

### `defineWork` — the run result without restating it

A declared `run` sits at a property position, which is not an inference site, so `commit`'s `result`
was `unknown` unless the bag's `results` pinned it. A generic function call is an inference site:

```ts
verify: defineWork<AuthBag, "verify">()({
  run: ({ handlers }) => handlers.verify(), // the result type comes from here
  commit: ({ result, updateContext }) =>
    updateContext((context) => ({ ...context, ok: result.ok })),
  candidates: [
    { to: "done", label: "verified", when: ({ context }) => context.ok },
    { to: "twofa", label: "retry" }
  ]
});
```

`commit` gets a typed `result`, and `run`'s `event` is narrowed to the key the entry is declared
under. The call is curried because TypeScript infers all of a call's type arguments or none: pinning
the bag and event inline would opt the result type out of inference, which is the problem being
solved.

Guards are untouched and stay total functions of context — the run result reaches them only through
what `commit` stages. Result-carrying guards were removed in the v2 subtraction for a correctness
reason that still holds: the same guards run during snapshot derivation, where no send is in flight,
so `availableEvents` would disagree with what a send actually does.

`results` on the bag still works and is unchanged; `defineWork` is the alternative for anyone who
would rather not keep a second declaration in sync.
