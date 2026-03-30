---
"apps-docs": major
---

Align the docs app with the 1.0 RC core and React APIs.

### Added

- Graph Builder API reference page
- Plugin architecture docs for analytics, autosave, execution-paths, and authoring
- Release verification and stability contract pages

### Changed

- Aligned examples with the simplified 4-parameter `JourneyDefinition` generics
- Clarified React provider startup timing around layout-phase `start()`
- Migrated React examples from `createJourneyBindings()` to the `createJourney()` runtime API
- Rewrote examples to use declarative graph and linear transition syntax
- Updated Core overview and quickstarts to show explicit `machine.start()` lifecycle
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
