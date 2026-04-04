# apps-docs

## 1.0.2

### Patch Changes

- c2c3323: Update docs and package readmes to match the current core size messaging.

## 1.0.1

### Patch Changes

- 563054b: Add the missing plugin docs (diagnostics, replay) pages and navigation entries.

## 1.0.0-rc.1

### Major Changes

- 1cdde02: Align the docs app with the 1.0 RC core and React APIs.

  ### Added
  - Graph Builder API reference page
  - Plugin architecture docs for analytics, autosave, execution-paths, and authoring
  - Release verification and stability contract pages

  ### Changed
  - Aligned examples with the simplified 4-parameter `JourneyDefinition` generics
  - Clarified React provider startup timing around layout-phase `startJourney()`
  - Migrated React examples from `createJourneyBindings()` to the `createJourney()` runtime API
  - Rewrote examples to use declarative graph and linear transition syntax
  - Updated Core overview and quickstarts to show explicit `machine.startJourney()` lifecycle
  - Updated examples to use `true` terminal transition shorthand where applicable
  - Updated Transitions Syntax with the Graph Builder / Option C coverage
  - Overhauled Core docs, architecture docs, and package READMEs

  ### Fixed
  - Cards cut off on mobile viewports
  - Image flicker on hydration
  - Search crash
  - Releases placement in the sidebar

  ### Removed
  - Auto-generated JavaScript snippet tabs in favor of TypeScript-only examples

### Minor Changes

- 679cf46: Update apps-docs for the new @rxova/journey-core transition-builder syntax. The docs now present choose(({ when, otherwise }) => [...]) as the preferred inline branching style and align examples with the callback-scoped helpers inside journey.transitions. See the @rxova/journey-core release notes in this release for the underlying API changes.

### Patch Changes

- 80b4cb8: Improved the docs experience for TypeScript examples by generating matching JavaScript tabs automatically. This includes better formatting preservation during TS-to-JS conversion, more consistent dark-theme syntax highlighting between TS and JS tabs, and updated Core overview examples that show more realistic event-driven journey flows.
- c096d11: Improve the release celebration modal with a proper version-title spacing fix and a canvas-confetti backdrop animation that performs better than the previous DOM-based effect.

## 0.7.1

### Patch Changes

- 62c57a5: # Fixes 3 bugs

  ## Search crashing
  - Explicitly annotate the docs search plugin configuration so the named plugin used in this site becomes the default when the preferred version is derived. The `docsPluginIdForPreferredVersion` option now points at `core`, preventing Docusaurus from assuming the default unnamed docs plugin exists.

  ## Home feature carousel tweaks
  - Switched the cards from fixed heights to `min-height` values so taller content no longer overflows, and reset height constraints at mobile breakpoints to allow cards to wrap naturally.
  - Reduced typography sizes across the carousel (headlines scaled from `text-2xl`/`text-lg` to `text-xl`/`text-base` with responsive fallbacks) so the text reads better on smaller viewports, while maintaining responsive overrides for larger screens.

  ## Navbar logo component
  - Added a custom `Navbar/Logo` theme component that renders a linked brand block with either a simple `<img>` or a `<ThemedImage>` when the logo supplies both light and dark sources. The component respects configured `href`, `target`, `alt`, sizing, and class names, falling back to the site title when no logo alt text is provided.

## 0.7.0

### Minor Changes

- 239f7c5: ## What changed
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

## 0.6.3

### Patch Changes

- 99a6635: Added a new public API TSDoc quality gate (docs:api:check) that verifies callable exports from package entrypoints have TSDoc summaries.
  - Enforced that check in CI/docs workflows and documented it in contributor/docs guides.
  - Added the checker implementation and comprehensive tests for pass/fail/CLI behavior.
  - Added/updated TSDoc on key public exports:
    - core transition builders (tx, createTransitions)
    - react bindings factory (createJourneyBindings)
    - devtools bridge attach + protocol envelope/command validators
  - No runtime behavior changes; this branch is primarily API documentation quality/tooling hardening.

  @rxova/journey-core
  - Added TSDoc summaries for public transition helpers (tx, createTransitions).
  - Added tests for the new API TSDoc checker (check-public-api-tsdoc) under core tests.
  - No runtime behavior changes.

  @rxova/journey-react
  - Added a TSDoc summary for createJourneyBindings (public React API entrypoint helper).
  - No runtime behavior changes.

  @rxova/journey-devtools-bridge
  - Added TSDoc summaries for public bridge/protocol APIs (attachJourneyDevtools and envelope/command validators).
  - No runtime behavior changes.

  apps-docs
  - Documented the new API docs quality gate (pnpm run docs:api:check) in the docs README.
  - No end-user docs content changes beyond contributor/developer guidance.

  repo/tooling (cross-package)
  - Added docs:api:check script to root package.json.
  - Added scripts/check-public-api-tsdoc.ts to enforce TSDoc coverage on public callable exports.
  - Wired this check into CI/docs workflows and contributing guidelines.

## 0.6.2

### Patch Changes

- 11c0218: # Summary
  - Enable versioned documentation for core, react and devtools-bridge
  - Minor UI improvements:
    - Remove navbar transparency
    - Link to Repo is a Github image
    - Streamlined footer
    - Chevron in foldable menues match the one in the left panel
    - Home Page minor updates

## 0.4.1

### Patch Changes

- Added a dedicated Devtools privacy policy page.
- Added a direct privacy policy URL reference under Web Store readiness docs.
- Added privacy policy navigation entry in the Devtool docs sidebar.

## 0.4.0

### Minor Changes

- 176007f: - Added full Chrome DevTools extension app
  - Added new bridge package with protocol + bridge runtime.
  - Added/expanded demo integration to exercise DevTools + bridge flows.
  - Added Devtool documentation section.
  - Updated docs UX in index.tsx, sidebars.ts, and search styling in styles.module.css.
  - Added CI/CD workflows for docs/devtools and Chrome Web Store publishing in devtools.yml, devtools-publish.yml, docs.yml.
  - Updated release/versioning config in config.json and scripts in package.json (pnpm run releases).
  - Updated README files across packages.
