---
title: Troubleshooting
sidebar_position: 7
---

## Panel says "Waiting for bridge messages"

Checklist:

1. Ensure app calls `attachJourneyDevtools(machine)`.
2. Confirm extension is installed from Chrome Web Store (once approval is live).
3. Reload page and reopen DevTools.
4. Ensure bridge is not disabled by `enabled: false` or production default.

## Extension not installable yet

If you cannot install the extension yet, Chrome Web Store approval is likely still pending.

In the meantime:

1. Keep bridge integration in place.
2. Validate machine transitions from your app UI.
3. Return to this guide once the store listing is published.

## Machine does not appear in selector

- `machineId` collisions can hide intent.
- Use unique ids per machine.
- Add explicit labels for quick visual confirmation.

## Commands do nothing

Potential causes:

- target machine id mismatch
- machine already terminal (`complete`/`terminated`)
- no matching transition for event

What to inspect:

- log entry kind and summary
- snapshot `status`
- transition graph order and guards in your journey definition

## `commandError` entries keep appearing

Typical reasons:

- async `when` throws/rejects
- async `effect` throws/rejects
- custom event payload shape mismatch

Actions:

1. Inspect async tab for per-step error details.
2. Validate event payload JSON sent from panel.
3. Run the same event from app UI and compare behavior.

## Logs are too large

- Keep display unbounded for diagnostics.
- Set display limit during routine usage.
- Use `Prune to limit` to reduce retained entries.

## Multiple apps open in different tabs

The panel is tab-scoped.

- switch to a different browser tab -> panel stream changes
- each tab tracks its own machine cache

## Production debugging not available

Default behavior disables bridge in production.

Use explicit enablement:

```ts
attachJourneyDevtools(machine, {
  enabled: true
});
```

Prefer guardrails when enabling in production:

- query-param gating
- environment flag
- internal-only domains
