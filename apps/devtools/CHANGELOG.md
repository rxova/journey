# apps-devtools

## 1.0.0-rc.3

### Patch Changes

- [#152](https://github.com/rxova/journey/pull/152) [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827) - Rebuild the browser DevTools panel around bridge protocol v7 and generic machine operations.

  - Render operation forms from bridge-provided descriptors, including typed text, integer, boolean,
    and JSON inputs, mutation state, structured output, and operation errors.
  - Add context patching, graph event dispatch, lifecycle and navigation controls, snapshot inspection,
    and protocol compatibility messaging without hard-coding machine-specific commands.
  - Improve multi-machine discovery and selection, connection state, replay registration, operation
    result routing, and stale-machine cleanup across the content, background, and panel boundaries.
  - Replace the monolithic panel store and application component with reducer, selector, provider,
    bridge-hook, feature-component, and section error-boundary layers.
  - Rebuild the timeline inspector with filtering, sorting, virtualized entries, selection details,
    snapshot diffs, current context, plugin state, and enabled graph event visibility.
  - Refresh the panel layout, theming, icons, empty states, responsive behavior, and accessible form
    controls for a denser inspection workflow.

- Updated dependencies [[`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`c805d79`](https://github.com/rxova/journey/commit/c805d796a5b99766636cbf2f5064366b3f87b827), [`51c20e6`](https://github.com/rxova/journey/commit/51c20e632119698195d3be2b3b7f82bdfb951902)]:
  - @rxova/journey-devtools-bridge@1.0.0-rc.4

## 1.0.0-rc.2

### Patch Changes

- Align the Chrome DevTools app with the `1.0.0-rc.2` release.

- Updated dependencies
  - @rxova/journey-devtools-bridge@1.0.0-rc.2

## 1.0.0-rc.1

### Major Changes

- 1cdde02: Upgrade the devtools app for the 1.0 RC release and bridge protocol v4 rollout.

  ### Added
  - Capability-aware controls that adapt to the inspected machine's registered plugins
  - Execution-path query support when the inspected machine has the plugin registered
  - Observation timeline events for transition tracing and async-state inspection
  - OS / DevTools theme following

  ### Changed
  - Accepts legacy protocol v3 bridge envelopes during extension-first rollouts
  - Keeps package versions aligned with the updated core and bridge releases
  - Replaced store ternary lookup with kind-based envelope lookup

  ### Fixed
  - Protocol version mismatch handling

### Minor Changes

- 679cf46: Bump apps-devtools to stay in sync with the new @rxova/journey-core and @rxova/journey-devtools-bridge minor releases. There are no app-specific feature changes in this branch beyond version alignment with the updated core transition-definition API. See the @rxova/journey-core release notes in this release for the detailed API changes.

### Patch Changes

- Updated dependencies [1cdde02]
  - @rxova/journey-devtools-bridge@1.0.0-rc.1

## 0.7.0

### Minor Changes

- 239f7c5: ## What changed
  - The panel now has section-level error boundaries around connection status, machine selection, timeline inspection, and commands. A failure in one area now degrades locally with a retry button instead of taking down the whole panel.
  - Timeline rendering was virtualized so large machine histories stay responsive. The panel now measures row height and viewport height, applies overscan, and keeps "follow latest" behavior working with the virtualized list.
  - Background and content-script cache replay was simplified around the assumption that retained machines already have seeded snapshot state, which makes reconnect and reopen behavior more predictable.
  - Panel styling was updated to support the new error-boundary states and the virtualized timeline layout without regressing the existing inspection flow.
  - Test coverage expanded significantly across the background worker, content script, panel app, store, command utilities, diff handling, and shared guards, giving much better regression coverage around the extension's message flow.
  - The app changelog was also backfilled with missing `0.5.0` and `0.6.0` release details so the DevTools release trail is now complete and aligned with the docs site.

  ## Breaking changes
  - None called out for `apps-devtools`.

### Patch Changes

- Updated dependencies [239f7c5]
  - @rxova/journey-devtools-bridge@0.7.0

## 0.6.0

### Minor Changes

- 01ef543: Version alignment release for Journey 0.6.0.
  - Aligns the Chrome DevTools app version with the 0.6.0 platform release.
  - Keeps the extension surface stable while consuming the current bridge/runtime stack.

### Patch Changes

- Updated dependencies [01ef543]
  - @rxova/journey-devtools-bridge@0.6.0

## 0.5.0

### Minor Changes

- 16db5e3: Platform-level DevTools refresh for Journey 0.5.0.
  - Reworked panel/store behavior for richer timeline inspection and snapshot diff handling.
  - Updated background/content/panel command flow to match the stabilized protocol model.
  - Expanded app-level test coverage across background/content/store/panel behaviors.

### Patch Changes

- Updated dependencies [16db5e3]
  - @rxova/journey-devtools-bridge@0.5.0

## 0.2.0

### Minor Changes

- 176007f: - Added full Chrome DevTools extension app
  - Added new bridge package with protocol + bridge runtime.
  - Added/expanded demo integration to exercise DevTools + bridge flows.
  - Added Devtool documentation section.
  - Updated docs UX in index.tsx, sidebars.ts, and search styling in styles.module.css.
  - Added CI/CD workflows for docs/devtools and Chrome Web Store publishing in devtools.yml, devtools-publish.yml, docs.yml.
  - Updated release/versioning config in config.json and scripts in package.json (pnpm run releases).
  - Updated README files across packages.

### Patch Changes

- Updated dependencies [176007f]
  - @rxova/journey-devtools-bridge@0.4.0
