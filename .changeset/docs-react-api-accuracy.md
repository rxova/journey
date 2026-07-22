---
"@rxova/journey-react": patch
---

Documentation accuracy. The React docs described the API as it stood before deferred start and
`useJourney` landed, so three of the corrections below are not stale phrasing but active
misdirection.

- **`autoStart` is documented as three-way**, matching what ships. The docs said it "defaults to
  `true`" in six places; the default is to start when the bundle's first Provider or hook mounts.
- **`useJourney` is now taught in the narrative docs.** It was reachable only from the generated
  API reference, because the docs' banned-identifier check still listed `useJourney` as an rc-era
  name — the check was silently keeping the shipping API out of the documentation.
- **The `useState` lazy-initializer pattern is no longer recommended for per-component ownership.**
  It was documented in full, including the claim that the machine "holds no global registrations or
  timers at rest" — which is false with `persist` or `autosave` configured. That pattern builds two
  machines per StrictMode mount and abandons one undisposed; `useJourney` exists to fix it.
- **The root README's "React: headless hooks" section is gone.** It documented
  `@rxova/journey-react/headless`, an entry point that no longer exists, alongside `useApi`,
  `useLinearJourney`, and `<LinearJourney>`. Replaced with the linear bundle, the graph bundle,
  `useJourney`, and the caller-owned `useSyncExternalStore` pattern.

- **The rc.2 → 1.0 migration guide's React section is rewritten.** Its "migrate to this" side
  taught a three-tier design that never shipped: `<LinearJourney>` with `LinearJourney.Step`
  children, `useLinearJourney`, and a `@rxova/journey-react/headless` entry point with
  `useOwnedJourney` and machine-argument hooks. It now describes the twin bundle factories,
  `useJourney` for per-component ownership, and the caller-owned `useSyncExternalStore` pattern,
  and it corrects the graph tier's ownership claim — the factory creates one machine, not one per
  Provider mount.

The banned-identifier check now scans `README.md` and every `packages/*/README.md` in addition to
the docs site. It already banned each removed identifier — the READMEs were simply never scanned,
which is exactly how the headless section survived. The migration guide is deliberately exempt from
that check, since it must name rc-era identifiers to teach the mapping; that exemption is also why
its stale 1.0 side went unnoticed, so it is worth reading manually whenever the API moves.
