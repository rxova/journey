---
"apps-docs": minor
---

## What changed

- The docs homepage was substantially redesigned with a rotating install typewriter, a feature carousel, stronger CTA hierarchy, and better entry points into the React guides. This is a real landing-page refresh, not just copy cleanup.
- Core docs were expanded across API overview, architecture, async behavior, FAQ, getting started, and lifecycle guidance. The new content explains selector subscriptions, lifecycle observability, `journey.start`, and the `send(...).error` result model much more clearly.
- React docs were refreshed to teach `useJourneySelector`, `useJourneyEvent`, provider lifecycle callbacks, `resetOnPersistenceChange`, and the updated `useJourneyApi()` return shape in a more direct, bindings-first way.
- Bridge and DevTools docs now explain Bun install flows, dev/prod environment detection, CSP and security expectations, privacy-policy requirements, and production-safe enablement defaults much more concretely.
- The docs no longer say the Chrome extension is still awaiting approval. They now point directly to the live Chrome Web Store listing and improve the discovery path from the runtime packages into the browser extension surface.
- DevTools release documentation was synced with the app changelog so missing historical `0.5.0` and `0.6.0` details are now present in the published docs.
- Package README files across Core, React, and the DevTools Bridge were updated in parallel so npm-facing documentation and docs-site documentation stay aligned.
- Install guidance now consistently includes Bun alongside npm, pnpm, and yarn, and the docs explicitly call out the `updateContext()` in-flight async caveat for both core and React consumers.

## Breaking changes

- None called out for `apps-docs`.
