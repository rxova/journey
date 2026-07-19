# Roadmap

This roadmap captures planned product, ecosystem, and tooling work for Journey. It is a living document and will change as the runtime stabilizes, adoption grows, and feedback sharpens priorities.

The current emphasis is clear: finish hardening the core contract ahead of the `1.0.0-rc` line, keep the React integration strong, and expand the ecosystem only where it meaningfully reduces adoption friction.

## Current Status

- [x] Automated npm publishing with GitHub Actions
- [x] Core API and type-system improvements
- [x] Browser devtools tooling
- [x] Developer experience polish
- [x] Documentation improvements and examples
- [x] Performance and bundle-size benchmarks
- [x] Testing utilities and harnesses
- [x] Compatibility coverage across supported framework and runtime targets
- [x] Release process improvements (versioning, changelog, prerelease flow)
- [x] Handler overrides at machine creation: `create*Journey(def, { handlers })` replaces the definition's handlers, a typed equivalent to test-time dependency injection (XState's `.provide()`)

## Near Term

- [ ] Finish stabilizing the pre-`1.0` public contract across core, React, and devtools bridge
- [ ] Continue improving migration guidance, docs accuracy, and example coverage around the current runtime model
- [ ] Tighten integration patterns for real apps: SSR, client boundaries, and multi-runtime ownership
- [ ] Keep improving devtools ergonomics for inspection, diagnostics, and debugging workflows

## Post V1

- [ ] History growth bounds: an opt-in `maxHistory` creation option that trims the oldest timeline
      entries (the 1.0 timeline is unbounded by design; `restart()` is the reset lever)
- [ ] First-class routing support for React apps
  - Focus areas: React Router, TanStack Router, and Next.js router integration patterns
- [ ] Additional framework packages
  - Initial targets: Vue and Angular
- [ ] Broader ecosystem integrations
  - Examples: persistence adapters, analytics adapters, and framework-specific recipes

## Longer-Term Exploration

- [ ] Richer tooling for flow visualization, structural analysis, and debugging workflows
- [ ] More opinionated starter patterns for large product flows and multi-team codebases
- [ ] Higher-level framework integrations built on top of the stable core contract

## Guiding Principles

- Keep the core runtime small, typed, and framework-agnostic
- Prefer explicit contracts over magic abstractions
- Grow ecosystem support without bloating the base packages
- Treat docs, migration clarity, and diagnostics as part of the product surface
