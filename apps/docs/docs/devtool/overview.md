---
id: overview
title: Devtool Overview
sidebar_label: Overview
---

Journey devtools has two parts:

- `@rxova/journey-devtools-bridge`: runtime message bridge.
- Devtools panel app: visualization + controls.

## Why It Exists

The devtools stack helps teams see journey behavior clearly: timeline movement, transition outcomes, async phases, and command effects.

## Protocol Version

Bridge protocol uses a fixed internal compatibility version.

## Command Surface

The panel can drive navigation, lifecycle controls, metadata updates, error clearing, and custom event sending through the bridge.

See full details in [Bridge API](/docs/devtool/bridge-api) and exact transport types in [Protocol](/docs/devtool/protocol).

## Snapshot Payload Focus

Panel state is driven by serialized machine snapshots including:

- history pointer model (`history.timeline`, `history.index`)
- current position (`currentStepId`)
- runtime state (`context`, `visited`, `stepMeta`, `status`, `async`)

For a full payload example, see [Bridge API](/docs/devtool/bridge-api).

## Time Travel UX

Panel supports:

- Redux-style timeline inspector rows with local selection
- follow-latest toggle and point-in-time `Action` / `State` / `Diff` inspection

Inspector selection does not mutate runtime machine state.
