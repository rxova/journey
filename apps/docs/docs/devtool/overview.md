---
title: Devtool Overview
sidebar_position: 1
---

<span className="badge badge--warning">Coming Soon</span>

The Journey Devtool is a Chrome DevTools integration for inspecting and controlling runtime Journey machines.

It is made of two pieces:

1. `@rxova/journey-devtools-bridge`: a small runtime bridge you attach to a machine in your app.
2. `apps/devtools`: the Chrome extension that renders the DevTools panel and sends commands.

This split keeps your app-side integration explicit and framework-agnostic while letting the extension evolve independently.

## What You Can Do

- Discover all Journey machines running in the inspected tab.
- Switch between multiple machines on the same page.
- Inspect full snapshots:
  - `current`
  - `status`
  - `context`
  - `history`
  - `visited`
  - async lifecycle state
- View event/transition activity in a live log.
- Trigger runtime commands from the panel:
  - `next`, `back`, `close`, `submit`
  - `goTo`
  - custom `send({ type, payload })`
  - `reset`, `clearStepError`, `clearHistory`, `trimHistory`

## Panel Screenshot

![Journey Devtools Panel Overview](/img/devtool/panel-overview.png)

## Architecture At A Glance

```mermaid
flowchart LR
  A["Journey App (Core/React)"] -->|"attachJourneyDevtools(machine)"| B["Bridge (window.postMessage)"]
  B --> C["Content Script"]
  C --> D["Background Service Worker"]
  D --> E["DevTools Panel"]
  E -->|"commands"| D
  D --> C
  C --> B
  B --> A
```

## Why This Design

- Explicit integration: no hidden monkey-patching of core runtime.
- Works for core and react equally (headless and UI flows).
- Robust command/result correlation using `requestId`.
- Safe fallback behavior: unknown envelopes are ignored.

## Scope (Current)

- Browser target: Chrome (Manifest V3)
- Focus: runtime inspection and command execution
- Not included yet: time-travel/replay

## Recommended Usage Pattern

- Keep bridge enabled in development.
- Use labels (`label`) to make multi-machine pages easier to debug.
- Assign stable `machineId` when you need deterministic identification across reloads.
- Keep flow decisions in transitions and use panel commands only as debugging controls.

## Next

- `/docs/devtool/getting-started`
- `/docs/devtool/bridge-api`
- `/docs/devtool/panel-guide`
- `/docs/devtool/protocol`
- `/docs/devtool/examples`
- `/docs/devtool/troubleshooting`
