# RFC 0003 — React Standalone Bundles: Twin Factories, Deferred Start, Shared Bindings

- **Status:** Accepted — implemented 2026-07-22. Supersedes RFC 0001 for the React tier.
- **Branch:** `feat/react-api-redesign`
- **Date:** 2026-07-22
- **Scope:** `@rxova/journey-react` (shipped surface), `@rxova/journey-core` (interceptor
  registration, context freezing), `@rxova/journey-common` (shared binding primitives)
- **Origin:** RFC 0001 was marked accepted while the implementation diverged from it on nearly
  every headline point, and the design that actually shipped was recorded only in
  `.changeset/react-v1-release.md`. The production-readiness audit in
  `docs/26.07.22_react-audit/` forced several further changes. This document is the contract.

---

## 1. Summary

The React tier is **two twin bundle factories** over one standalone core machine each:

```ts
createLinearJourney(definition, options?)   // @rxova/journey-react
createGraphJourney(definition, options?)    // @rxova/journey-react/graph
```

Both return the same shared surface — `machine`, `Provider`, `StepRenderer`, the reactive hooks
(`useSnapshot`, `useSelector`, `useStep`, `useContext`, `useSubscribeEvent`), the stable hooks
(`useMachine`, `useControls`, `useNavigation`), and `updateContext` — and differ only in their
tier verb: linear adds `navigate` and `useStepHandler`, graph adds `send`.

`useJourney(factory)` owns a bundle for one component instance when a module-scope machine is
wrong.

---

## 2. What this supersedes in RFC 0001

RFC 0001 is marked **Accepted**, and its own "Shipped divergences" block is itself stale. For the
React tier it should be read as historical. The substantive reversals:

| RFC 0001 mandated                                                                                 | What shipped, and why                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<Wizard>` + package-level `useWizard()` as the headline, factory as escape hatch (§1, §3)        | Only the factory. A component-level headline needs React context to find the machine, which makes every hook Provider-bound; the factory makes the machine an ordinary module value that non-React code can drive. |
| A third **headless** tier at `/headless` (§5)                                                     | Deleted. React's own `useSyncExternalStore` over a core machine is the headless tier; a package entry added nothing. Documented as a README pattern.                                                               |
| Graph machine created **per `<Provider>` mount**, multiple Providers = independent instances (§4) | One machine per factory call, shared by every Provider. Per-instance ownership is `useJourney`'s job, not the Provider's.                                                                                          |
| "No module-scope machine → no cross-request state leaks" (§3.11)                                  | Module-scope machines are the default and _do_ share state across requests in a server process. This is now stated plainly rather than designed away; `useJourney` is the escape hatch.                            |
| Per-tier folders — `src/wizard/`, `src/graph/`, `src/headless/` (§9)                              | Flat `src/`, one file per concern.                                                                                                                                                                                 |

Two RFC 0001 decisions were **not** reversed and are reaffirmed below: the verbatim-wrapper rule
(§3.12) and moving the start out of construction (§3.12).

---

## 3. The verbatim-wrapper rule (reaffirmed from RFC 0001 §3.12)

> Anything a Vue or Svelte wrapper would have to reimplement identically belongs below React.

The wrapper reshapes nothing. `navigate`, `send`, `controls`, and `updateContext` are the core
objects, passed through. Options are core's `JourneyRuntimeOptions`, forwarded whole — the linear
factory rest-destructures its own `name` field and forwards the remainder, so a field core adds
later cannot be silently dropped.

This rule is also why the shared binding primitives (§6) do not live in the React package.

---

## 4. Deferred start

**The machine starts when the first Provider, reactive hook, `useSubscribeEvent`, or
`useStepHandler` mounts** — not when the factory runs.

Core defaults `autoStart` to `false` and says why: subscribe-before-start is the order that lets a
subscriber observe the journey's first `stepEnter`. The React tier previously overrode this to
`true`, and because core's `start()` runs synchronously in its constructor, the first `stepEnter`
and `statusChange` fired while the factory was still returning — before any component could
exist. `useSubscribeEvent` attaches in a layout effect, so that first entry was _structurally
unobservable_. A test encoded the miss as expected behaviour.

`autoStart` is three-way in this tier:

| Value             | Behaviour                                                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| omitted (default) | Start from a layout effect on first mount. `controls.start()` is idempotent, so many components still start it exactly once.                                     |
| `true`            | Start eagerly in the factory. Required for server-rendered step content, and for a bundle driven entirely from non-React code, since nothing mounts to start it. |
| `false`           | Start nothing; the caller calls `controls.start()`.                                                                                                              |

**Effect ordering is part of the contract.** The start hook is declared _last_ in every hook that
subscribes or registers, because layout effects fire in hook order — the store subscription and
the interceptor registration must both be live before the start effect can emit. Ordering it
first reintroduces the exact bug this section exists to fix.

**Consequence for SSR:** layout effects do not run on the server, so the default renders
`fallback` on both sides and hydration is deterministic. This is what RFC 0001 §3.11 wanted.

---

## 5. Render purity

Nothing is written to a ref during render. `useSelector` mirrors React's own
`useSyncExternalStoreWithSelector`: a per-derivation cache built in `useMemo`, and the last
_committed_ selection in a ref advanced from an effect. The latest-ref assignments behind
`useSubscribeEvent` and `useStepHandler` are likewise effect-driven.

A render React starts and then discards must not advance the baseline that `equalityFn` compares
against; with an identity-field equality it could otherwise pin a stale value indefinitely. This
also makes the package React Compiler compatible.

`react-hooks/refs` is enforced repo-wide rather than disabled, which is the actual regression net
— a discarded concurrent render cannot be reproduced reliably in jsdom.

The one sanctioned exception is `useJourney`'s lazy initialization, written as a single
assign-and-read expression (`bundleRef.current ??= factory()`), which the rule accepts.

---

## 6. Shared binding primitives live in `@rxova/journey-common`

Two pieces of a framework binding are pure logic and identical for React, Vue, or Angular:

- **`createSnapshotSource`** — multiplexes one machine subscription across every mounted view.
  Core runs every registered selector on every publish, so subscribing per view made it repeat
  identical work once per subscriber; this makes the machine's per-publish cost constant.
- **`createSelectorCache`** — the same-snapshot short circuit plus committed-value reuse. The
  committed value is passed in rather than stored, because only the host framework knows which
  renders committed.

**These are in `packages/common`, not a new package.** `common` is private and bundled into its
consumers, exactly as core already uses `@rxova/journey-common/dev`, so this adds no published
package, no version lockstep, and no runtime dependency. A published `@rxova/journey-bindings` was
prototyped and rejected: the genuinely shareable surface is two functions, which does not justify
a versioned public package.

Step-id validation and the `autoStart` policy deliberately stayed in React — a few lines each,
where relocating buys indirection rather than reuse. They can follow if a second wrapper wants
them.

---

## 7. Lifecycle

- A **module-scope bundle is never disposed.** Its machine, subscriptions, and plugin resources
  (autosave timers, persistence writers) live for the process. That is the trade for a journey
  that outlives every component, and it means one bundle serves every request in a server process.
- **`useJourney(factory)`** owns one bundle per component instance and disposes on unmount.
  Disposal is deferred by a macrotask so StrictMode's simulated unmount cancels it while a real
  unmount still disposes. It initializes into a ref rather than a `useState` lazy initializer,
  because React double-invokes those under StrictMode — which built _two_ fully-configured
  machines and abandoned one undisposed.

---

## 8. Core changes this tier required

- **`registerNextStepInterceptor` keeps a per-step stack**, not a single slot. Resolution is still
  last-wins, but unregistering the active registration reinstates the one it shadowed. Two mounted
  components guarding one step is ordinary for a component-scoped wrapper; previously, unmounting
  the newer one left the step silently ungated in production.
- **The snapshot `context` is shallow-frozen in development**, matching every other snapshot
  slice. Mutating it in place was silent — no publish, no notification, no re-render.

---

## 9. Open questions

- **Publish coalescing.** A single `goToNextStep` publishes up to four times, and plugins with
  `deriveSnapshot` add more. React's auto-batching collapses only those in one tick, so a
  navigation commits two to four renders. Core has no batching primitive. Fixing it changes
  observable subscription behaviour for _all_ core consumers and needs its own RFC.
- **React version support.** The peer range says `>=18.2.0`, the README says 19, `CONTRIBUTING.md`
  says 18+, and only 19.2.7 is ever installed or tested. `useSyncExternalStore`'s
  `getServerSnapshot` contract differs subtly between 18.2 and 19, so the claim is unverified
  either way. Pick one and enforce it in CI.
- **A server-environment warning** for module-scope bundles was designed and deferred: it must
  fire for a module-scope bundle and stay silent for a `useJourney`-owned one, which needs a
  module-level flag that each independently-bundled entrypoint would see a separate copy of.
- **ESM code splitting.** Each entrypoint embeds its own copy of the bindings; `dist/client.js` is
  a full duplicate of `dist/index.js` rather than a re-export. Byte cost only — the package holds
  no module state — but unshared.
