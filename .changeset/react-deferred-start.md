---
"@rxova/journey-react": major
---

**Breaking:** the React tier no longer starts the machine inside the factory by default. It now
starts from a layout effect on first mount, so subscribers attach before the journey's first
`stepEnter` — previously that event fired during `createLinearJourney()` / `createGraphJourney()`
and was structurally impossible to observe through `useSubscribeEvent`.

`autoStart` becomes three-way in this tier:

- **omitted (new default)** — the machine starts when the first Provider, reactive hook,
  `useSubscribeEvent`, or `useStepHandler` mounts. `controls.start()` is idempotent, so mounting
  many components still starts it exactly once.
- **`true`** — the previous behaviour: the machine starts eagerly inside the factory. Use it when
  the server must render step content, or when the bundle is driven entirely from non-React code.
- **`false`** — unchanged: nothing starts until you call `controls.start()`.

Consequences to check when upgrading:

- **SSR now renders `fallback` by default.** Layout effects do not run on the server, so the
  machine is still idle there and both sides agree — which is what makes hydration deterministic.
  Pass `autoStart: true` to restore server-rendered step content.
- **A bundle driven only from non-React code needs `autoStart: true`** (or an explicit
  `controls.start()`), because nothing ever mounts to start it.
- **`useSubscribeEvent` now receives the initial `stepEnter` and `statusChange`.** Listeners that
  assumed the first entry was already missed will see one more event than before.
