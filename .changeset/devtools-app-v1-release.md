---
"apps-devtools": patch
---

Rebuild the browser DevTools panel around bridge protocol v7 and generic machine operations.

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
