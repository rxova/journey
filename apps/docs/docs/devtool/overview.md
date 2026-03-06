---
id: overview
title: Chrome DevTools Overview
sidebar_label: Overview
---

Journey devtools has two parts:

- `@rxova/journey-devtools-bridge`: runtime message bridge.
- Devtools panel app: visualization + controls.

## Download Extension

Install the extension from Chrome Web Store:

- https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm

Preview:

![Journey Devtools Overview](/img/devtool/panel-overview.png)

## Why It Exists

The devtools stack helps teams see journey behavior clearly: timeline movement, transition outcomes, async phases, and command effects.

## Protocol Version

Bridge protocol uses a fixed internal compatibility version.

## Command Surface

The panel can drive navigation, lifecycle controls, metadata updates, error clearing, and custom event sending through the bridge.

See full details in [Bridge API](/docs/bridge/bridge-api) and exact transport types in [Protocol](/docs/bridge/protocol).

## Snapshot Payload Focus

Panel state is driven by serialized machine snapshots including:

- history pointer model (`history.timeline`, `history.index`)
- current position (`currentStepId`)
- runtime state (`context`, `visited`, `stepMeta`, `status`, `async`)

For a full payload example, see [Bridge API](/docs/bridge/bridge-api).

## Time Travel UX

Panel supports:

- Redux-style timeline inspector rows with local selection
- follow-latest toggle and point-in-time `Action` / `State` / `Diff` inspection

Inspector selection does not mutate runtime machine state.
