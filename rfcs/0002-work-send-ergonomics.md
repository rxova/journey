# RFC 0002 — Work-Send Ergonomics: Result Routing, Totality, Handler Scope

- **Status:** Accepted — §2 and §3 implemented 2026-07-18 (see §7); §4 recorded as keep; §5 deferred
- **Branch:** `feat/react-api-redesign`
- **Date:** 2026-07-18
- **Scope:** `@rxova/journey-core` (graph runtime + builder types); example/docs alignment
- **Origin:** external audit of `examples/core-showcase-graph` (see `docs/26.07.18_plan/`), verified claim-by-claim against the runtime and tests

---

## 1. Summary & Motivation

The transactional work send — `run` → staged `commit` → candidates routed on the staged context,
all-or-nothing — is the graph runtime's most differentiated feature, and an external review
confirmed it lands well. The same review surfaced four ergonomic pressure points around it. This
RFC records a decision for each so they stop resurfacing as apparent oversights:

| #   | Item                                                                 | Decision proposed here                                  |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| 2   | Guards can't see the work result — transient facts leak into context | **Accept**: pass `result` to work-send candidate guards |
| 3   | The totality rule (unguarded fallback) is invisible folklore         | **Accept sugar + diagnostic**, semantics unchanged      |
| 4   | Step hooks receive no handlers                                       | **Keep**, rationale recorded (now also in docs)         |
| 5   | Spread-based context updates are verbose                             | **Defer**: optional adapter territory, core untouched   |

Verified behavior this RFC builds on (all test- or source-confirmed):

- `commit` writes to a local staged context; candidates evaluate against it; if none is enabled the
  staged context is discarded (`core/runtime.ts` `sendWithWork`, test
  `graph/__tests__/send-work.test.ts` "rolls back the staged context when no candidate is enabled").
- Guards receive exactly `{ context, handlers }` (`graph/graph.types.ts` `TransitionGuard`).
- Hook args carry no `handlers` key, by explicit doc-comment ("step hooks deliberately do not
  receive handlers").
- Self-transitions run the full `onLeave` → `onTransition` → `onEnter` lifecycle; there is no
  `from === to` special case.

## 2. Work-result routing — **Accept**

### Problem

The only channel from `run` to the candidate guards is persistent context. The showcase must
persist `lastVerifyOk: boolean | null` — a control-flow intermediate — solely so a guard can read
it. That value then travels through persistence, replay, analytics, and devtools as if it were
business state. This was the audit's strongest legitimate criticism, and it generalizes: every
work send whose routing depends on the result (most of them) pays the same tax or launders the
result through a context field.

### Proposal

Work-send candidate guards additionally receive the `run` result:

```ts
work({
  run: ({ snapshot, handlers }) => handlers.api.verifyCode(snapshot.context.verificationCode),
  commit: ({ result, updateContext }) =>
    updateContext((context) => ({
      ...context,
      attempts: result.success ? context.attempts : context.attempts + 1
    })),
  candidates: ({ to, stay }) => [
    to("loggedIn").when(({ result }) => result.success),
    to("blocked").when(({ context, handlers }) => handlers.hasExhaustedAttempts(context)),
    stay()
  ]
});
```

`lastVerifyOk` disappears from context entirely.

### Design decisions

1. **Typing.** The candidates of a `work(...)` call are authored inside the work factory, so the
   builder can thread `TResult` into their guard signature
   (`when(({ context, handlers, result }) => …)`) without touching the standalone
   `TransitionGuard`. Candidates declared outside `work` (plain arrays) keep the current
   `{ context, handlers }` signature — `result` exists only where a `run` exists.
2. **Snapshot introspection.** `outgoingTransitions` evaluates guards outside any send, where no
   result exists. Rule: a guard that reads `result` evaluates with `result: undefined` during
   introspection; the descriptor's `guard` field reports the evaluated outcome as today. This must
   be documented on the snapshot page — introspection shows the resting-state answer, the send
   shows the live one. (Alternative considered and rejected: a distinct `guard: "result-dependent"`
   marker; it complicates the descriptor for little gain, and the staged-context evaluation already
   has the same "live vs resting" property.)
3. **Runtime cost.** `resolveTransition` already receives the staged context in the work path;
   threading the result alongside it is mechanical (`sendWithWork` → `resolveTransition` →
   `isEnabled`).

### Consequences

The showcase and quickstart drop result-mirroring context fields; docs gain a line in the
transactional-sends section. `commit` remains the only writer of durable state — `result` in a
guard is read-only routing input, not a context bypass.

## 3. Totality ergonomics — **Accept (sugar + dev diagnostic, semantics frozen)**

### Problem

"A failure outcome needs an unguarded fallback candidate or its staged context rolls back" is
load-bearing, correct, and currently expressed only as a comment convention. Forgetting the
fallback fails silently: the send returns `no-enabled-transition` and the error message /attempt
count the commit staged simply never appears.

### Proposal

Two additions, no semantic change:

1. **`stay()` sugar** in the work factory's candidate scope: `stay()` ≡ `to(<current step id>)`,
   unguarded by default and chainable like any candidate (`stay().when(...)` allowed but the
   default is the point). It names the intent — "on any other outcome, keep the staged context and
   remain here" — and makes totality greppable:

   ```ts
   candidates: ({ to, stay }) => [to("loggedIn").when(({ result }) => result.success), stay()];
   ```

2. **Dev-mode diagnostic:** when a `work(...)` declaration's candidate list contains no unguarded
   candidate, warn once at build/create time (same channel as other definition validation). An
   intentionally partial event silences it with an explicit escape hatch (naming to bikeshed:
   `work({ ..., allowRollback: true })`).

### Non-goals

Auto-inserting a fallback, or retaining staged context on no-match, are explicitly rejected: they
would break the transaction's "routed-and-committed or neither" guarantee, which is the feature.

## 4. Handlers in step hooks — **Keep the asymmetry (decision recorded)**

The audit read the asymmetry as an inconsistency. It is a boundary: handlers reach the places
where the definition _decides_ — guards and event work. Hooks react to a move that has already
committed; nothing they do can influence routing or be rolled back, so handing them injected
clients invites transactional-looking side effects in a non-transactional position. A hook that
needs a service can close over it at module scope, and that closure is a designed irritant — a
nudge that the call probably belongs in work (the showcase's `setup2fa.onEnter` demonstrates the
closure deliberately).

**Decision:** keep. The rationale now lives in `apps/docs/docs/core/handlers.md` ("Scope") where
users hit the wall. **Revisit trigger:** if post-quickstart feedback keeps producing the complaint
from people who have read that section, reopen with a scoped proposal (e.g. read-only handlers in
`onEnter` only), not a blanket threading.

## 5. Immer-style context updates — **Defer**

Spread-based updates are ordinary immutable JavaScript, predictable, and dependency-free; the core
size budget (4.5 kB brotli per entry, `packages/core/package.json` size-limit) rules out bundling a
draft mechanism. If demand materializes, the right shape is an optional adapter that wraps
`updateContext` with a draft-producing equivalent — the same optional-layer pattern as the
subscription-enhancer plugin. No core change; nothing to design until someone asks with a concrete
context shape that hurts.

## 6. Rollout

1. §2 (result routing) and §3 (stay + diagnostic) can ship together as one core change with builder
   type updates and the send-work test suite extended: result visible to guards, introspection with
   `result: undefined`, `stay()` equivalence, diagnostic firing and escape hatch.
2. Examples: showcase drops `lastVerifyOk` and adopts `stay()`; quickstart adopts `stay()`.
3. Docs: transactional-sends section gains `result` and `stay()`; snapshot page gains the
   introspection rule.

Both changes are pre-1.0 and additive to the authoring surface; the only observable behavior
change is intentional (guards seeing `result` during a work send).

## 7. Implementation notes (2026-07-18)

All three rollout steps landed together. Deviations and decisions made during implementation:

1. **Typed `result` requires the candidates-callback form.** The RFC's original §2 sketch showed
   the event-scoped `to` producing a result-reading guard; that cannot be typed, because the
   event callback runs before `work(...)` declares `TResult`. The realized API is
   `candidates: ({ to, stay }) => [...]` — a work-scoped `to`/`stay` whose guards receive
   `{ context, handlers, result: TResult }` (`WorkGuardArgs` in `builder.types.ts`). The plain
   array form remains valid for guards that only need context/handlers.
2. **`stay()` lives in both scopes.** The event callback (`({ to, work, stay })`) for plain
   candidate arrays, and the work candidates callback for result-typed lists. Both produce the
   same unguarded self-candidate.
3. **Runtime threading.** `sendWithWork` passes the run result through
   `resolveTransition` → `isEnabled` into every guard evaluated for that send —
   array-form (untyped) guards simply ignore the extra key. Outside a work send, including
   `outgoingTransitions` introspection, guards see `result: undefined`, as specified.
4. **Diagnostic channel.** The totality warning is a `console.warn` at `build()` time, dev-only
   (`NODE_ENV !== "production"`, read via `globalThis` so the dependency-free core never assumes
   Node types or a bundler define). The escape hatch shipped as proposed: `allowRollback: true`.
5. **Coverage.** `graph/__tests__/send-work.test.ts` — "work-result routing and stay()": result
   routing without context persistence, `stay()` committing staged context on no-match,
   introspection with `result: undefined`, the warning firing, and both silencing paths
   (`stay()` present, `allowRollback`).
